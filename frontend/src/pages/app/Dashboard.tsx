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
  manual: "#94A3B8",
  indiamart: "#2563EB",
  tradeindia: "#4338CA",
  website: "#0D9488",
  referral: "#BE185D",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  manual: "Manual",
  indiamart: "IndiaMART",
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

  const funnelCard = (
    <div className="card p-5">
      <h2 className="panel-header font-display font-semibold text-ink-900 mb-5">Lead Pipeline Funnel</h2>
      <div className="flex flex-col gap-3">
        {data.funnel.map((stage, i) => (
          <div key={stage.stage}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-ink-700">{stage.stage}</span>
              <span className="text-ink-500">{stage.count}</span>
            </div>
            <div className="h-2.5 rounded-full bg-ink-100 overflow-hidden">
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
      <div>
        <h1 className="text-2xl font-display font-semibold text-ink-900">
          {isTelecaller ? "My Dashboard" : "Dashboard"}
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          {isTelecaller ? "An overview of your assigned leads." : "An overview of your team's pipeline."}
        </p>
      </div>

      {data.stale_leads.count > 0 && (
        <div className="card border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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

      {isAdmin ? (
        funnelCard
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">{funnelCard}</div>

          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="panel-header font-display font-semibold text-ink-900">Follow Ups</h2>
              {!isTelecaller && (
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    className="input pl-7 py-1.5 text-xs w-40"
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
                    className="flex items-center gap-3 py-3 animate-fade-in-up"
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
        <h2 className="panel-header font-display font-semibold text-ink-900 mb-4">
          {isTelecaller ? "My Lead Sources" : "Lead Sources"}
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
                    contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="panel-header font-display font-semibold text-ink-900">Activity &amp; Performance</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  className="input pl-7 py-1.5 text-xs w-40"
                  placeholder="Search assignee..."
                  value={perfSearch}
                  onChange={(e) => setPerfSearch(e.target.value)}
                />
              </div>
              <div className="flex rounded-lg border border-ink-100 bg-ink-50 p-0.5">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPerfRange(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      perfRange === opt.value ? "bg-white shadow-sm text-ink-900" : "text-ink-500"
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="panel-header font-display font-semibold text-ink-900">Recent Lead Activity</h2>
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
                    className="border-t border-ink-100 hover:bg-bg/60 transition-colors duration-150 animate-fade-in"
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
