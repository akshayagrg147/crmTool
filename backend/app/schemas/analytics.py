from datetime import datetime

from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    total_leads: int
    total_leads_delta: float
    assigned: int
    assigned_delta: float
    converted: int
    converted_delta: float
    talk_time_minutes: float
    talk_time_delta: float
    total_order_value: float
    total_order_value_delta: float


class FunnelStage(BaseModel):
    stage: str
    count: int


class PerformanceRow(BaseModel):
    assignee_id: str
    assignee_name: str
    calls: int
    duration_minutes: float


class PerformanceTable(BaseModel):
    rows: list[PerformanceRow]
    total_calls: int
    total_duration_minutes: float


class FollowUpItem(BaseModel):
    id: str
    name: str
    phone: str
    assignee_name: str | None
    last_contacted_at: datetime | None
    next_follow_up_at: datetime | None = None
    is_overdue: bool = False


class StaleLeadAlert(BaseModel):
    count: int
    sample: list[str]


class RecentLead(BaseModel):
    id: str
    name: str
    phone: str
    status: str
    source: str
    assignee_name: str | None
    created_at: datetime


class SourceBreakdown(BaseModel):
    source: str
    count: int


class DashboardResponse(BaseModel):
    kpis: DashboardKPIs
    funnel: list[FunnelStage]
    follow_ups: list[FollowUpItem]
    stale_leads: StaleLeadAlert
    recent_leads: list[RecentLead]
    source_breakdown: list[SourceBreakdown]


class HourlyVolume(BaseModel):
    hour: int
    calls: int


class LeaderboardRow(BaseModel):
    assignee_id: str
    assignee_name: str
    talk_time_minutes: float
    calls: int


class OutcomeSlice(BaseModel):
    outcome: str
    count: int


class CityBreakdown(BaseModel):
    city: str
    leads_count: int
    converted_count: int
    order_value: float


class AnalyticsResponse(BaseModel):
    total_calls: int
    total_talk_time_minutes: float
    avg_call_length_minutes: float
    not_picked_rate: float
    total_order_value: float
    avg_order_value: float
    hourly_volume: list[HourlyVolume]
    leaderboard: list[LeaderboardRow]
    minutes_per_member: list[LeaderboardRow]
    outcomes: list[OutcomeSlice]
    city_breakdown: list[CityBreakdown]
