import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_org_user
from app.models.call_log import CallLog
from app.models.lead import Lead, LeadStatus
from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.analytics import (
    AnalyticsResponse,
    CityBreakdown,
    DashboardKPIs,
    DashboardResponse,
    FollowUpItem,
    FunnelStage,
    HourlyVolume,
    LeaderboardRow,
    OutcomeSlice,
    ProductBreakdown,
    RecentLead,
    SourceBreakdown,
    StaleLeadAlert,
)

router = APIRouter(tags=["analytics"])


def _scope_lead_query(stmt, current: CurrentUser):
    stmt = stmt.where(Lead.organization_id == current.organization_id)
    if current.role == UserRole.telecaller:
        stmt = stmt.where(Lead.assigned_to == current.id)
    return stmt


def _scope_call_query(stmt, current: CurrentUser, assignee_id: uuid.UUID | None = None):
    stmt = stmt.join(Lead, CallLog.lead_id == Lead.id).where(Lead.organization_id == current.organization_id)
    if current.role == UserRole.telecaller:
        stmt = stmt.where(CallLog.logged_by == current.id)
    elif assignee_id is not None:
        stmt = stmt.where(CallLog.logged_by == assignee_id)
    return stmt


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=7)
    prev_period_start = now - timedelta(days=14)

    total_q = _scope_lead_query(select(func.count()).select_from(Lead), current)
    total = (await db.execute(total_q)).scalar_one()

    total_prev_q = _scope_lead_query(
        select(func.count()).select_from(Lead).where(Lead.created_at < period_start), current
    )
    total_prev = (await db.execute(total_prev_q)).scalar_one()
    total_curr_q = _scope_lead_query(
        select(func.count()).select_from(Lead).where(Lead.created_at >= period_start), current
    )
    total_curr = (await db.execute(total_curr_q)).scalar_one()

    assigned_q = _scope_lead_query(select(func.count()).select_from(Lead).where(Lead.assigned_to.isnot(None)), current)
    assigned = (await db.execute(assigned_q)).scalar_one()

    converted_q = _scope_lead_query(
        select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.converted), current
    )
    converted = (await db.execute(converted_q)).scalar_one()
    converted_period_q = _scope_lead_query(
        select(func.count()).select_from(Lead).where(
            Lead.status == LeadStatus.converted, Lead.last_contacted_at >= period_start
        ), current
    )
    converted_period = (await db.execute(converted_period_q)).scalar_one()

    talk_time_q = _scope_call_query(select(func.coalesce(func.sum(CallLog.duration_minutes), 0)), current)
    talk_time = float((await db.execute(talk_time_q)).scalar_one())

    talk_time_period_q = _scope_call_query(
        select(func.coalesce(func.sum(CallLog.duration_minutes), 0)).where(CallLog.created_at >= period_start), current
    )
    talk_time_period = float((await db.execute(talk_time_period_q)).scalar_one())
    talk_time_prev_q = _scope_call_query(
        select(func.coalesce(func.sum(CallLog.duration_minutes), 0)).where(
            CallLog.created_at >= prev_period_start, CallLog.created_at < period_start
        ), current
    )
    talk_time_prev = float((await db.execute(talk_time_prev_q)).scalar_one())

    order_value_q = _scope_call_query(select(func.coalesce(func.sum(CallLog.order_value), 0)), current)
    total_order_value = float((await db.execute(order_value_q)).scalar_one())
    order_value_period_q = _scope_call_query(
        select(func.coalesce(func.sum(CallLog.order_value), 0)).where(CallLog.created_at >= period_start), current
    )
    order_value_period = float((await db.execute(order_value_period_q)).scalar_one())
    order_value_prev_q = _scope_call_query(
        select(func.coalesce(func.sum(CallLog.order_value), 0)).where(
            CallLog.created_at >= prev_period_start, CallLog.created_at < period_start
        ), current
    )
    order_value_prev = float((await db.execute(order_value_prev_q)).scalar_one())

    def pct_delta(curr, prev):
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 1)

    kpis = DashboardKPIs(
        total_leads=total,
        total_leads_delta=pct_delta(total_curr, total_prev),
        assigned=assigned,
        assigned_delta=0.0,
        converted=converted,
        converted_delta=pct_delta(converted_period, 0),
        talk_time_minutes=talk_time,
        talk_time_delta=pct_delta(talk_time_period, talk_time_prev),
        total_order_value=total_order_value,
        total_order_value_delta=pct_delta(order_value_period, order_value_prev),
    )

    contacted_q = _scope_lead_query(
        select(func.count()).select_from(Lead).where(Lead.last_contacted_at.isnot(None)), current
    )
    contacted = (await db.execute(contacted_q)).scalar_one()

    funnel = [
        FunnelStage(stage="Total", count=total),
        FunnelStage(stage="Assigned", count=assigned),
        FunnelStage(stage="Contacted", count=contacted),
        FunnelStage(stage="Converted", count=converted),
    ]

    followup_q = _scope_lead_query(
        select(Lead).where(Lead.status == LeadStatus.follow_up), current
    ).order_by(Lead.next_follow_up_at.asc().nullslast(), Lead.last_contacted_at.desc().nullslast()).limit(10)
    followup_result = await db.execute(followup_q)
    follow_leads = followup_result.scalars().all()
    follow_ups = []
    for lead in follow_leads:
        assignee_name = None
        if lead.assigned_to:
            u = await db.execute(select(User.name).where(User.id == lead.assigned_to))
            assignee_name = u.scalar_one_or_none()
        follow_ups.append(
            FollowUpItem(
                id=str(lead.id), name=lead.name, phone=lead.phone,
                assignee_name=assignee_name, last_contacted_at=lead.last_contacted_at,
                next_follow_up_at=lead.next_follow_up_at,
                is_overdue=lead.next_follow_up_at is not None and lead.next_follow_up_at < now,
            )
        )

    stale_cutoff = now - timedelta(hours=48)
    stale_q = _scope_lead_query(
        select(Lead).where(
            Lead.status.notin_([LeadStatus.converted, LeadStatus.lost]),
            Lead.last_contacted_at.is_(None),
            Lead.created_at < stale_cutoff,
        ), current
    ).limit(5)
    stale_result = await db.execute(stale_q)
    stale_leads = stale_result.scalars().all()
    stale_count_q = _scope_lead_query(
        select(func.count()).select_from(Lead).where(
            Lead.status.notin_([LeadStatus.converted, LeadStatus.lost]),
            Lead.last_contacted_at.is_(None),
            Lead.created_at < stale_cutoff,
        ), current
    )
    stale_count = (await db.execute(stale_count_q)).scalar_one()

    recent_q = _scope_lead_query(select(Lead), current).order_by(Lead.created_at.desc()).limit(6)
    recent_result = await db.execute(recent_q)
    recent_leads_rows = recent_result.scalars().all()
    recent_leads = []
    for lead in recent_leads_rows:
        assignee_name = None
        if lead.assigned_to:
            u = await db.execute(select(User.name).where(User.id == lead.assigned_to))
            assignee_name = u.scalar_one_or_none()
        recent_leads.append(
            RecentLead(
                id=str(lead.id), name=lead.name, phone=lead.phone, status=lead.status.value,
                source=lead.source.value, assignee_name=assignee_name, created_at=lead.created_at,
            )
        )

    source_stmt = _scope_lead_query(select(Lead.source, func.count()), current).group_by(Lead.source)
    source_result = await db.execute(source_stmt)
    source_breakdown = sorted(
        (SourceBreakdown(source=s.value, count=c) for s, c in source_result.all()),
        key=lambda row: row.count,
        reverse=True,
    )

    return DashboardResponse(
        kpis=kpis,
        funnel=funnel,
        follow_ups=follow_ups,
        stale_leads=StaleLeadAlert(count=stale_count, sample=[l.name for l in stale_leads]),
        recent_leads=recent_leads,
        source_breakdown=source_breakdown,
    )


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
    date_range: str = Query(default="7d", alias="range", pattern="^(today|7d|all)$"),
    assignee_id: uuid.UUID | None = Query(default=None),
):
    now = datetime.now(timezone.utc)
    base = select(CallLog)
    base = _scope_call_query(base, current, assignee_id)

    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        base = base.where(CallLog.created_at >= start)
    elif date_range == "7d":
        base = base.where(CallLog.created_at >= now - timedelta(days=7))

    total_calls_q = select(func.count()).select_from(base.subquery())
    total_calls = (await db.execute(total_calls_q)).scalar_one()

    talk_time_q = select(func.coalesce(func.sum(base.subquery().c.duration_minutes), 0))
    total_talk_time = float((await db.execute(talk_time_q)).scalar_one())

    avg_call_length = round(total_talk_time / total_calls, 2) if total_calls else 0.0

    not_picked_q = select(func.count()).select_from(
        base.where(CallLog.outcome == LeadStatus.not_picked).subquery()
    )
    not_picked = (await db.execute(not_picked_q)).scalar_one()
    not_picked_rate = round((not_picked / total_calls) * 100, 1) if total_calls else 0.0

    hour_col = func.extract("hour", CallLog.created_at).label("hour")
    hourly_stmt = _scope_call_query(select(hour_col, func.count().label("calls")), current, assignee_id)
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        hourly_stmt = hourly_stmt.where(CallLog.created_at >= start)
    elif date_range == "7d":
        hourly_stmt = hourly_stmt.where(CallLog.created_at >= now - timedelta(days=7))
    hourly_stmt = hourly_stmt.group_by(hour_col).order_by(hour_col)
    hourly_result = await db.execute(hourly_stmt)
    hourly_map = {int(h): c for h, c in hourly_result.all()}
    hourly_volume = [HourlyVolume(hour=h, calls=hourly_map.get(h, 0)) for h in range(24)]

    leaderboard_stmt = (
        select(User.id, User.name, func.coalesce(func.sum(CallLog.duration_minutes), 0), func.count(CallLog.id))
        .join(CallLog, CallLog.logged_by == User.id)
        .join(Lead, CallLog.lead_id == Lead.id)
        .where(Lead.organization_id == current.organization_id)
    )
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        leaderboard_stmt = leaderboard_stmt.where(CallLog.created_at >= start)
    elif date_range == "7d":
        leaderboard_stmt = leaderboard_stmt.where(CallLog.created_at >= now - timedelta(days=7))
    if current.role == UserRole.telecaller:
        leaderboard_stmt = leaderboard_stmt.where(User.id == current.id)
    elif assignee_id is not None:
        leaderboard_stmt = leaderboard_stmt.where(User.id == assignee_id)
    leaderboard_stmt = leaderboard_stmt.group_by(User.id, User.name).order_by(func.sum(CallLog.duration_minutes).desc())
    leaderboard_result = await db.execute(leaderboard_stmt)
    leaderboard = [
        LeaderboardRow(assignee_id=str(uid), assignee_name=name, talk_time_minutes=float(mins), calls=calls)
        for uid, name, mins, calls in leaderboard_result.all()
    ]

    outcomes_stmt = _scope_call_query(select(CallLog.outcome, func.count()), current, assignee_id)
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        outcomes_stmt = outcomes_stmt.where(CallLog.created_at >= start)
    elif date_range == "7d":
        outcomes_stmt = outcomes_stmt.where(CallLog.created_at >= now - timedelta(days=7))
    outcomes_stmt = outcomes_stmt.group_by(CallLog.outcome)
    outcomes_result = await db.execute(outcomes_stmt)
    outcomes = [OutcomeSlice(outcome=o.value, count=c) for o, c in outcomes_result.all()]

    order_value_stmt = select(func.coalesce(func.sum(CallLog.order_value), 0))
    order_value_stmt = _scope_call_query(order_value_stmt, current, assignee_id)
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        order_value_stmt = order_value_stmt.where(CallLog.created_at >= start)
    elif date_range == "7d":
        order_value_stmt = order_value_stmt.where(CallLog.created_at >= now - timedelta(days=7))
    total_order_value = float((await db.execute(order_value_stmt)).scalar_one())
    avg_order_value = round(total_order_value / total_calls, 2) if total_calls else 0.0

    # City-wise breakdown: lifetime lead/conversion counts, order value scoped to the selected range.
    city_counts_stmt = _scope_lead_query(
        select(
            Lead.city, func.count(Lead.id),
            func.sum(case((Lead.status == LeadStatus.converted, 1), else_=0)),
        ).where(Lead.city.isnot(None)),
        current,
    ).group_by(Lead.city)
    city_counts_result = await db.execute(city_counts_stmt)
    city_counts = {city: (leads, converted) for city, leads, converted in city_counts_result.all()}

    city_value_stmt = (
        select(Lead.city, func.coalesce(func.sum(CallLog.order_value), 0))
        .select_from(CallLog)
        .join(Lead, CallLog.lead_id == Lead.id)
        .where(Lead.organization_id == current.organization_id, Lead.city.isnot(None))
    )
    if current.role == UserRole.telecaller:
        city_value_stmt = city_value_stmt.where(CallLog.logged_by == current.id)
    elif assignee_id is not None:
        city_value_stmt = city_value_stmt.where(CallLog.logged_by == assignee_id)
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        city_value_stmt = city_value_stmt.where(CallLog.created_at >= start)
    elif date_range == "7d":
        city_value_stmt = city_value_stmt.where(CallLog.created_at >= now - timedelta(days=7))
    city_value_stmt = city_value_stmt.group_by(Lead.city)
    city_value_result = await db.execute(city_value_stmt)
    city_values = {city: float(val) for city, val in city_value_result.all()}

    city_breakdown = [
        CityBreakdown(
            city=city, leads_count=leads, converted_count=converted or 0,
            order_value=city_values.get(city, 0.0),
        )
        for city, (leads, converted) in city_counts.items()
    ]
    city_breakdown.sort(key=lambda c: c.order_value, reverse=True)

    # Product-wise breakdown: orders count + order value from call logs, scoped to the selected range.
    product_stmt = (
        select(Product.id, Product.name, func.count(CallLog.id), func.coalesce(func.sum(CallLog.order_value), 0))
        .select_from(CallLog)
        .join(Product, CallLog.product_id == Product.id)
        .join(Lead, CallLog.lead_id == Lead.id)
        .where(Lead.organization_id == current.organization_id)
    )
    if current.role == UserRole.telecaller:
        product_stmt = product_stmt.where(CallLog.logged_by == current.id)
    elif assignee_id is not None:
        product_stmt = product_stmt.where(CallLog.logged_by == assignee_id)
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        product_stmt = product_stmt.where(CallLog.created_at >= start)
    elif date_range == "7d":
        product_stmt = product_stmt.where(CallLog.created_at >= now - timedelta(days=7))
    product_stmt = product_stmt.group_by(Product.id, Product.name).order_by(func.sum(CallLog.order_value).desc())
    product_result = await db.execute(product_stmt)
    product_breakdown = [
        ProductBreakdown(product_id=str(pid), product_name=name, orders_count=count, order_value=float(value))
        for pid, name, count, value in product_result.all()
    ]

    return AnalyticsResponse(
        total_calls=total_calls,
        total_talk_time_minutes=total_talk_time,
        avg_call_length_minutes=avg_call_length,
        not_picked_rate=not_picked_rate,
        total_order_value=total_order_value,
        avg_order_value=avg_order_value,
        hourly_volume=hourly_volume,
        leaderboard=leaderboard,
        minutes_per_member=leaderboard,
        outcomes=outcomes,
        city_breakdown=city_breakdown,
        product_breakdown=product_breakdown,
    )
