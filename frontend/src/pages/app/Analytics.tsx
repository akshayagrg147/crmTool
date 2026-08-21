import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PhoneCall, Clock, Timer, PhoneMissed, IndianRupee, Wallet, MapPinned } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analyticsApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useAnimateIn } from "@/hooks/useAnimateIn";
import { KpiCard } from "@/components/KpiCard";
import { PageLoading } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { formatMinutes, initials, formatCurrency, formatCurrencyFull } from "@/lib/format";
import type { LeadStatus } from "@/api/types";

const RANGE_OPTIONS: { value: "today" | "7d" | "all"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "all", label: "All Time" },
];

const OUTCOME_COLORS: Record<LeadStatus, string> = {
  new: "#315D85",
  follow_up: "#B8893A",
  not_picked: "#9AA4AC",
  converted: "#36785E",
  lost: "#B64B45",
};

const OUTCOME_LABELS: Record<LeadStatus, string> = {
  new: "New",
  follow_up: "Follow Up",
  not_picked: "Not Picked",
  converted: "Converted",
  lost: "Lost",
};

export function AnalyticsPage() {
  const { user } = useAuth();
  const isTelecaller = user?.role === "telecaller";
  const [range, setRange] = useState<"today" | "7d" | "all">("7d");
  const [memberFilter, setMemberFilter] = useState("");

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["analytics", range, memberFilter],
    queryFn: () => analyticsApi.analytics(range, memberFilter || undefined),
    placeholderData: keepPreviousData,
  });

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: usersApi.list, enabled: !isTelecaller });
  const telecallers = team?.filter((t) => t.role === "telecaller" || t.role === "manager") ?? [];

  // Kicks in once the analytics payload lands, so the bars grow from zero.
  const animateIn = useAnimateIn(!isLoading && !!data);

  if (isLoading || !data) return <PageLoading />;

  const peakHour = data.hourly_volume.reduce((max, h) => (h.calls > max.calls ? h : max), data.hourly_volume[0]);
  const maxLeaderboard = Math.max(...data.leaderboard.map((l) => l.talk_time_minutes), 1);

  return (
    <div className={`flex flex-col gap-6 transition-opacity duration-200 ${isPlaceholderData ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-5">
        <div>
          <p className="page-eyebrow mb-1">Workspace / Reporting</p>
          <h1 className="page-title">
            {isTelecaller ? "My Calling Analytics" : "Calling Analytics"}
          </h1>
          <p className="page-subtitle">Call volume, talk time, outcomes, and commercial performance.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          {!isTelecaller && (
            <select aria-label="Filter analytics by team member" className="input w-full py-2 sm:w-auto" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
              <option value="">All Team Members</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex w-full rounded-[10px] border border-ink-100 bg-white p-1 shadow-btn sm:w-auto" role="group" aria-label="Analytics date range">
            {RANGE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setRange(opt.value)}
                aria-pressed={range === opt.value}
                className={`flex-1 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors sm:flex-none ${
                  range === opt.value ? "bg-primary-soft text-primary-dark" : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Total Calls" value={String(data.total_calls)} icon={PhoneCall} color="orange" />
        <KpiCard label="Total Talk Time" value={formatMinutes(data.total_talk_time_minutes)} icon={Clock} color="indigo" />
        <KpiCard label="Avg Call Length" value={`${data.avg_call_length_minutes}m`} icon={Timer} color="teal" />
        <KpiCard label="Not-Picked Rate" value={`${data.not_picked_rate}%`} icon={PhoneMissed} color="pink" />
        <KpiCard label="Total Order Value" value={formatCurrency(data.total_order_value)} icon={IndianRupee} color="teal" />
        <KpiCard label="Avg Order Value" value={formatCurrency(data.avg_order_value)} icon={Wallet} color="indigo" />
      </div>

      <div className="card p-5 sm:p-6">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="page-eyebrow mb-1">Daily cadence</p>
            <h2 className="panel-header font-semibold text-ink-900">Call volume by hour</h2>
            <p className="mt-1 text-xs text-ink-500">Identify the hours when your team is most active.</p>
          </div>
          {peakHour && peakHour.calls > 0 && (
            <span className="badge border border-accent/15 bg-accent-soft text-accent-dark">Peak hour · {peakHour.hour}:00</span>
          )}
        </div>
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly_volume} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="#E1E3E2" />
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => `${h}:00`}
                tick={{ fontSize: 10, fill: "#6A7782" }}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tick={{ fontSize: 11, fill: "#6A7782" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [`${value} calls`, ""]}
                labelFormatter={(h) => `${h}:00`}
                cursor={{ fill: "rgba(23,58,94,.04)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #E1E3E2", boxShadow: "0 14px 34px -22px rgba(24,37,51,.32)" }}
              />
              <Bar
                dataKey="calls"
                radius={[6, 6, 0, 0]}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.hourly_volume.map((h) => (
                  <Cell key={h.hour} fill={h.hour === peakHour?.hour && h.calls > 0 ? "#B8893A" : "#B8C8D5"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 sm:p-6">
          <div className="mb-5">
            <p className="page-eyebrow mb-1">Team standing</p>
            <h2 className="panel-header font-semibold text-ink-900">Talk-time leaderboard</h2>
          </div>
          {!data.leaderboard.length ? (
            <EmptyState icon={PhoneCall} title="No calls yet" />
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.leaderboard.map((row, i) => (
                <div
                  key={row.assignee_id}
                  className="flex items-center gap-3"
                >
                  <span className={`w-5 text-sm font-bold ${i < 3 ? "text-accent-dark" : "text-ink-300"}`}>{i + 1}</span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary-soft text-[11px] font-semibold text-primary-dark">
                    {initials(row.assignee_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-ink-900 truncate">{row.assignee_name}</span>
                      <span className="text-ink-500 shrink-0 ml-2">{formatMinutes(row.talk_time_minutes)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-primary transition-[width] duration-[900ms] ease-out"
                        style={{
                          width: animateIn ? `${(row.talk_time_minutes / maxLeaderboard) * 100}%` : "0%",
                          transitionDelay: `${Math.min(i, 10) * 80}ms`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-5">
            <p className="page-eyebrow mb-1">Activity allocation</p>
            <h2 className="panel-header font-semibold text-ink-900">Minutes per team member</h2>
          </div>
          {!data.minutes_per_member.length ? (
            <EmptyState icon={Clock} title="No calls yet" />
          ) : (
            <div style={{ height: Math.max(240, Math.min(data.minutes_per_member.length * 48, 520)) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.minutes_per_member} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="2 5" horizontal={false} stroke="#E1E3E2" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6A7782" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="assignee_name"
                    width={90}
                    tick={{ fontSize: 11, fill: "#6A7782" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} min`, "Talk time"]}
                    cursor={{ fill: "rgba(23,58,94,.04)" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #E1E3E2", boxShadow: "0 14px 34px -22px rgba(24,37,51,.32)" }}
                  />
                  <Bar dataKey="talk_time_minutes" fill="#2F6F6D" radius={[0, 5, 5, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="mb-4">
          <p className="page-eyebrow mb-1">Disposition mix</p>
          <h2 className="panel-header font-semibold text-ink-900">Call outcomes</h2>
        </div>
        {!data.outcomes.length ? (
          <EmptyState icon={PhoneCall} title="No calls logged in this range" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.outcomes}
                    dataKey="count"
                    nameKey="outcome"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {data.outcomes.map((o) => (
                      <Cell key={o.outcome} fill={OUTCOME_COLORS[o.outcome]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, entry: any) => [value, OUTCOME_LABELS[entry.payload.outcome as LeadStatus]]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #E1E3E2", boxShadow: "0 14px 34px -22px rgba(24,37,51,.32)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data.outcomes.map((o) => (
                  <tr key={o.outcome} className="border-t border-ink-100 first:border-t-0">
                    <td className="py-2.5 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: OUTCOME_COLORS[o.outcome] }} />
                      {OUTCOME_LABELS[o.outcome]}
                    </td>
                    <td className="py-2.5 text-right font-medium text-ink-900">{o.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="card p-5 sm:p-6">
          <div className="mb-4">
            <p className="page-eyebrow mb-1">Geographic view</p>
            <h2 className="panel-header font-semibold text-ink-900">City performance</h2>
          </div>
          {!data.city_breakdown.length ? (
            <EmptyState icon={MapPinned} title="No city data yet" message="Add a city to your leads to see performance here." />
          ) : (
            <>
            <div className="-mx-5 hidden overflow-x-auto scroll-shadow-x sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                    <th className="font-medium px-5 py-2">City</th>
                    <th className="font-medium px-5 py-2">Leads</th>
                    <th className="font-medium px-5 py-2">Converted</th>
                    <th className="font-medium px-5 py-2">Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.city_breakdown.map((c) => (
                    <tr key={c.city} className="border-t border-ink-100 hover:bg-bg/60">
                      <td className="px-5 py-3 font-medium text-ink-900">{c.city}</td>
                      <td className="px-5 py-3 text-ink-700">{c.leads_count}</td>
                      <td className="px-5 py-3 text-ink-700">{c.converted_count}</td>
                      <td className="px-5 py-3 text-ink-700" title={formatCurrencyFull(c.order_value)}>
                        {formatCurrency(c.order_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-ink-100 sm:hidden">
              {data.city_breakdown.map((c) => (
                <article key={c.city} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink-900">{c.city}</p>
                    <span className="text-sm font-bold text-primary" title={formatCurrencyFull(c.order_value)}>{formatCurrency(c.order_value)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-ink-100 bg-[#F8F7F3] p-2.5"><dt className="text-ink-400">Leads</dt><dd className="mt-0.5 font-semibold text-ink-700">{c.leads_count}</dd></div>
                    <div className="rounded-lg border border-ink-100 bg-[#F8F7F3] p-2.5"><dt className="text-ink-400">Converted</dt><dd className="mt-0.5 font-semibold text-success">{c.converted_count}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
