import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  Trophy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Plus,
  ArrowRight,
  IndianRupee,
  Globe2,
  ChevronRight,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { analyticsApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useAnimateIn } from "@/hooks/useAnimateIn";
import { KpiCard } from "@/components/KpiCard";
import { PageLoading } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge, SourceBadge } from "@/components/StatusBadge";
import { formatMinutes, timeAgo, initials, formatCurrency, formatCallbackTime } from "@/lib/format";
import type { LeadSource } from "@/api/types";

const SOURCE_COLORS: Record<LeadSource, string> = {
  manual: "#8A959E",
  indiamart: "#173A5E",
  justdial: "#B8893A",
  tradeindia: "#4B5E88",
  website: "#2F6F6D",
  referral: "#8D5572",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  manual: "Manual",
  indiamart: "IndiaMART",
  justdial: "JustDial",
  tradeindia: "TradeIndia",
  website: "Website",
  referral: "Referral",
};

const RANGE_OPTIONS: { value: "today" | "7d" | "all"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "all", label: "All Time" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [followUpSearch, setFollowUpSearch] = useState("");
  const [perfRange, setPerfRange] = useState<"today" | "7d" | "all">("7d");
  const [perfSearch, setPerfSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: analyticsApi.dashboard,
  });

  // Kicks in once the dashboard payload lands, so the bars grow from zero.
  const animateIn = useAnimateIn(!isLoading && !!data);

  const { data: perfData, isPlaceholderData: perfIsStale } = useQuery({
    queryKey: ["analytics", perfRange],
    queryFn: () => analyticsApi.analytics(perfRange),
    placeholderData: keepPreviousData,
  });

  const filteredPerf = useMemo(() => {
    if (!perfData) return [];
    if (!perfSearch) return perfData.minutes_per_member;
    return perfData.minutes_per_member.filter((r) => r.assignee_name.toLowerCase().includes(perfSearch.toLowerCase()));
  }, [perfData, perfSearch]);

  const filteredFollowUps = useMemo(() => {
    if (!data) return [];
    if (!followUpSearch) return data.follow_ups;
    return data.follow_ups.filter((f) => f.assignee_name?.toLowerCase().includes(followUpSearch.toLowerCase()));
  }, [data, followUpSearch]);

  if (isLoading || !data) return <PageLoading />;

  const isTelecaller = user?.role === "telecaller";
  const isAdmin = user?.role === "admin";
  const maxFunnel = Math.max(...data.funnel.map((f) => f.count), 1);
  const leadTotal = Math.max(data.kpis.total_leads, 1);
  const conversionRate = Math.min(100, Math.max(0, Math.round((data.kpis.converted / leadTotal) * 100)));

  const funnelCard = (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-1">Stage distribution</p>
          <h2 className="panel-header font-semibold text-ink-900">Lead pipeline funnel</h2>
        </div>
        <span className="badge border border-primary/10 bg-primary-soft text-primary-dark">Live</span>
      </div>
      <div className="flex flex-col gap-3">
        {data.funnel.map((stage, i) => (
          <div key={stage.stage}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-ink-700">{stage.stage}</span>
              <span className="text-ink-500">{stage.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-primary transition-[width] duration-[900ms] ease-out"
                style={{
                  width: animateIn ? `${(stage.count / maxFunnel) * 100}%` : "0%",
                  opacity: 1 - i * 0.12,
                  transitionDelay: `${i * 110}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1.5 text-xs text-ink-300">
        <span>Home</span>
        <ChevronRight size={13} />
        <span className="font-semibold text-ink-700">Dashboard</span>
      </div>
      <div className="dashboard-hero relative overflow-hidden rounded-[14px] border border-white/10 px-5 py-6 text-white shadow-[0_20px_45px_-30px_rgba(14,41,66,0.9)] sm:px-7 sm:py-7">
        <div className="absolute inset-y-0 right-0 hidden w-[42%] border-l border-white/[0.06] lg:block" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="mb-3 h-px w-12 bg-accent" />
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h1 className="max-w-2xl font-serif text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">
              {isTelecaller ? "Good to see you, keep the momentum." : "Your team, in one clear view."}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              {isTelecaller ? "An overview of your assigned leads and next conversations." : "An overview of your team's pipeline, activity, and opportunities."}
            </p>
          </div>
          <Link
            to="/leads"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Open lead queue <ArrowRight size={15} />
          </Link>
        </div>
        <div className="relative z-10 mt-6 grid max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 text-xs text-white/70 sm:grid-cols-3">
          <div className="bg-primary-dark/30 px-3.5 py-2.5"><strong className="mr-1 text-sm text-white">{data.kpis.total_leads}</strong> total leads</div>
          <div className="bg-primary-dark/30 px-3.5 py-2.5"><strong className="mr-1 text-sm text-white">{data.kpis.converted}</strong> converted</div>
          <div className="min-w-0 bg-primary-dark/30 px-3.5 py-2.5"><strong className="mr-1 break-words text-sm text-white">{formatCurrency(data.kpis.total_order_value)}</strong> order value</div>
        </div>
      </div>

      {data.stale_leads.count > 0 && (
        <div className="card flex items-start gap-3 border-warning/25 bg-accent-soft/55 p-4">
          <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink-900">
              {data.stale_leads.count} lead{data.stale_leads.count > 1 ? "s" : ""} need attention
            </p>
            <p className="text-sm text-ink-500 mt-0.5">
              These leads are open with zero calls logged, and were created over 48 hours ago:{" "}
              {data.stale_leads.sample.join(", ")}
              {data.stale_leads.count > data.stale_leads.sample.length && "…"}
            </p>
          </div>
          <Link to="/leads?status=new" className="btn-secondary shrink-0 text-xs px-3 py-1.5">
            Review
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          label="Total Leads"
          value={String(data.kpis.total_leads)}
          delta={data.kpis.total_leads_delta}
          icon={Users}
          color="orange"
          to="/leads"
        />
        <KpiCard label="Assigned" value={String(data.kpis.assigned)} icon={UserCheck} color="indigo" to="/leads" />
        <KpiCard
          label="Converted"
          value={String(data.kpis.converted)}
          delta={data.kpis.converted_delta}
          icon={Trophy}
          color="teal"
          to="/leads?status=converted"
        />
        <KpiCard
          label="Talk Time"
          value={formatMinutes(data.kpis.talk_time_minutes)}
          delta={data.kpis.talk_time_delta}
          icon={Clock}
          color="pink"
          to="/analytics"
        />
        <KpiCard
          label="Order Value"
          value={formatCurrency(data.kpis.total_order_value)}
          delta={data.kpis.total_order_value_delta}
          icon={IndianRupee}
          color="teal"
          to="/analytics"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)] gap-5">
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="page-eyebrow mb-1">Pipeline movement</p>
              <h2 className="panel-header text-base">Lead activity</h2>
              <p className="text-xs text-ink-500 mt-1">A quick view of where your leads sit today.</p>
            </div>
            <Link to="/analytics" className="btn-ghost text-xs px-2.5 py-1.5">Full analytics <ArrowRight size={13} /></Link>
          </div>
          <div className="mt-7 flex h-40 items-end gap-2 border-b border-ink-100 px-1 sm:gap-5">
            {data.funnel.map((stage, i) => (
              <div key={stage.stage} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2 h-full">
                <span className="text-[11px] font-semibold text-ink-700 opacity-0 transition-opacity group-hover:opacity-100">{stage.count}</span>
                <div
                  className="w-full max-w-12 rounded-t-md transition-all duration-700"
                  style={{
                    height: animateIn ? `${Math.max((stage.count / maxFunnel) * 78, 7)}%` : "7%",
                    transitionDelay: `${i * 90}ms`,
                    background: "linear-gradient(180deg, #B8893A 0%, #173A5E 100%)",
                  }}
                />
                <span className="max-w-16 truncate text-[10px] font-medium text-ink-500">{stage.stage.replace("Not Picked", "Not picked")}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
            <span>Tracked across {data.kpis.total_leads} leads</span>
            <span className="font-semibold text-success">{data.kpis.converted} converted this period</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[14px] border border-primary-light/30 bg-primary-dark p-6 text-white shadow-[0_20px_45px_-30px_rgba(14,41,66,0.9)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border-[34px] border-white/[0.035]" />
          <div className="absolute bottom-0 left-0 h-28 w-28 bg-[radial-gradient(circle_at_bottom_left,rgba(184,137,58,0.13),transparent_70%)]" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Conversion health</p>
                <h2 className="mt-1 text-lg font-semibold">Team performance</h2>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/10">
                <Trophy size={17} className="text-accent" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(#C99B4A ${conversionRate * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}>
                <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full border border-white/10 bg-primary-dark">
                  <span className="text-2xl font-bold tracking-[-0.04em]">{conversionRate}%</span>
                  <span className="text-[10px] uppercase tracking-wide text-white/55">converted</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="break-words text-xl font-bold tracking-[-0.04em] sm:text-2xl">{formatCurrency(data.kpis.total_order_value)}</p>
                <p className="mt-1 text-xs text-white/65">total order value</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-secondary" />
                  {data.kpis.converted} successful conversions
                </div>
              </div>
            </div>
            <Link to="/analytics" className="mt-auto flex items-center justify-between border-t border-white/10 pt-4 text-xs font-semibold text-white/75 transition-colors hover:text-white">
              View performance report <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {isAdmin ? (
        funnelCard
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">{funnelCard}</div>

          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="panel-header font-semibold text-ink-900">Follow ups</h2>
              {!isTelecaller && (
                <div className="relative w-full sm:w-auto">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    aria-label="Search follow ups by assignee"
                    className="input w-full py-1.5 pl-7 text-xs sm:w-40"
                    placeholder="Search assignee..."
                    value={followUpSearch}
                    onChange={(e) => setFollowUpSearch(e.target.value)}
                  />
                </div>
              )}
            </div>
            {filteredFollowUps.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No follow-ups pending"
                message="You're all caught up. New follow-ups will show up here."
                action={
                  <Link to="/leads" className="btn-primary text-xs px-3 py-1.5">
                    <Plus size={14} /> Add Follow Up
                  </Link>
                }
              />
            ) : (
              <div className="flex flex-col divide-y divide-ink-100">
                {filteredFollowUps.map((f, i) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 py-3"
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  >
                    <div className="h-9 w-9 rounded-full bg-badge-indigo/10 text-badge-indigo flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(f.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-ink-900 truncate">{f.name}</p>
                        {f.is_overdue && <span className="badge bg-danger/10 text-danger shrink-0">Pending</span>}
                      </div>
                      <p className={`text-xs flex items-center gap-1 ${f.is_overdue ? "text-danger" : "text-ink-500"}`}>
                        {f.next_follow_up_at ? (
                          <>
                            <Clock size={11} />
                            {f.is_overdue ? "Was due" : "Call back"} {formatCallbackTime(f.next_follow_up_at)}
                          </>
                        ) : (
                          <>
                            {f.phone} {f.assignee_name && `· ${f.assignee_name}`} · {timeAgo(f.last_contacted_at)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="panel-header mb-4 font-semibold text-ink-900">
          {isTelecaller ? "My lead sources" : "Lead sources"}
        </h2>
        {!data.source_breakdown.length ? (
          <EmptyState icon={Globe2} title="No leads yet" message="Once leads come in, you'll see where they're coming from here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.source_breakdown}
                    dataKey="count"
                    nameKey="source"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {data.source_breakdown.map((s) => (
                      <Cell key={s.source} fill={SOURCE_COLORS[s.source]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, entry: any) => [value, SOURCE_LABELS[entry.payload.source as LeadSource]]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #E1E3E2", boxShadow: "0 14px 34px -22px rgba(24,37,51,.32)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data.source_breakdown.map((s) => {
                  const total = data.source_breakdown.reduce((sum, r) => sum + r.count, 0);
                  const pct = total ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <tr key={s.source} className="border-t border-ink-100 first:border-t-0">
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.source] }} />
                        {SOURCE_LABELS[s.source]}
                      </td>
                      <td className="py-2.5 text-right text-ink-500">{pct}%</td>
                      <td className="py-2.5 text-right font-medium text-ink-900 w-14">{s.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isTelecaller && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="panel-header font-semibold text-ink-900">Activity &amp; performance</h2>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  aria-label="Search performance by assignee"
                  className="input w-full py-1.5 pl-7 text-xs sm:w-40"
                  placeholder="Search assignee..."
                  value={perfSearch}
                  onChange={(e) => setPerfSearch(e.target.value)}
                />
              </div>
              <div className="flex w-full rounded-[10px] border border-ink-100 bg-white p-1 shadow-btn sm:w-auto" role="group" aria-label="Performance date range">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPerfRange(opt.value)}
                    aria-pressed={perfRange === opt.value}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none ${
                      perfRange === opt.value ? "bg-primary-soft text-primary-dark" : "text-ink-500 hover:text-ink-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!filteredPerf.length ? (
            <EmptyState icon={Clock} title="No call activity yet" message="Once calls are logged, performance shows up here." />
          ) : (
            <div className={`overflow-x-auto scroll-shadow-x -mx-5 transition-opacity duration-200 ${perfIsStale ? "opacity-60" : ""}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                    <th className="font-medium px-5 py-2">Assignee</th>
                    <th className="font-medium px-5 py-2">Calls</th>
                    <th className="font-medium px-5 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPerf.map((row) => (
                    <tr key={row.assignee_id} className="border-t border-ink-100 hover:bg-bg/60">
                      <td className="px-5 py-3 font-medium text-ink-900">{row.assignee_name}</td>
                      <td className="px-5 py-3 text-ink-700">{row.calls}</td>
                      <td className="px-5 py-3 text-ink-700">{formatMinutes(row.talk_time_minutes)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ink-100 font-semibold">
                    <td className="px-5 py-3 text-ink-900">Total</td>
                    <td className="px-5 py-3 text-ink-900">{filteredPerf.reduce((s, r) => s + r.calls, 0)}</td>
                    <td className="px-5 py-3 text-ink-900">
                      {formatMinutes(filteredPerf.reduce((s, r) => s + r.talk_time_minutes, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="panel-header font-semibold text-ink-900">Recent lead activity</h2>
          <Link to="/leads" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
            View all leads <ArrowRight size={14} />
          </Link>
        </div>
        {data.recent_leads.length === 0 ? (
          <EmptyState icon={Users} title="No leads yet" message="Add your first lead to get started." />
        ) : (
          <div className="overflow-x-auto scroll-shadow-x -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                  <th className="font-medium px-5 py-2">Lead</th>
                  <th className="font-medium px-5 py-2">Source</th>
                  <th className="font-medium px-5 py-2">Status</th>
                  <th className="font-medium px-5 py-2">Assigned To</th>
                  <th className="font-medium px-5 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_leads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className="border-t border-ink-100 hover:bg-bg/60 transition-colors duration-150"
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{lead.name}</p>
                      <p className="text-xs text-ink-500">{lead.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <SourceBadge source={lead.source} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-3 text-ink-700">{lead.assignee_name ?? "Unassigned"}</td>
                    <td className="px-5 py-3 text-ink-500">{timeAgo(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
