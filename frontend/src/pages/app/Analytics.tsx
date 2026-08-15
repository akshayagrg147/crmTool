import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PhoneCall, Clock, Timer, PhoneMissed, IndianRupee, Wallet, MapPinned, Package } from "lucide-react";
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
  new: "#0D9488",
  follow_up: "#D97706",
  not_picked: "#94A3B8",
  converted: "#059669",
  lost: "#DC2626",
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-ink-900">
            {isTelecaller ? "My Calling Analytics" : "Calling Analytics"}
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">Call volume, talk time, and outcomes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!isTelecaller && (
            <select className="input py-2 w-auto" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
              <option value="">All Team Members</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-lg border border-ink-100 bg-ink-50 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  range === opt.value ? "bg-white shadow-sm text-ink-900" : "text-ink-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Total Calls" value={String(data.total_calls)} icon={PhoneCall} color="orange" />
        <KpiCard label="Total Talk Time" value={formatMinutes(data.total_talk_time_minutes)} icon={Clock} color="indigo" />
        <KpiCard label="Avg Call Length" value={`${data.avg_call_length_minutes}m`} icon={Timer} color="teal" />
        <KpiCard label="Not-Picked Rate" value={`${data.not_picked_rate}%`} icon={PhoneMissed} color="pink" />
        <KpiCard label="Total Order Value" value={formatCurrency(data.total_order_value)} icon={IndianRupee} color="teal" />
        <KpiCard label="Avg Order Value" value={formatCurrency(data.avg_order_value)} icon={Wallet} color="indigo" />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="panel-header font-display font-semibold text-ink-900">Call Volume by Hour</h2>
          {peakHour && peakHour.calls > 0 && (
            <span className="badge bg-primary/10 text-primary">Peak: {peakHour.hour}:00</span>
          )}
        </div>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly_volume}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10, fill: "#64748B" }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [`${value} calls`, ""]}
                labelFormatter={(h) => `${h}:00`}
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
              />
              <Bar
                dataKey="calls"
                radius={[6, 6, 0, 0]}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.hourly_volume.map((h) => (
                  <Cell key={h.hour} fill={h.hour === peakHour?.hour && h.calls > 0 ? "#2563EB" : "#DBEAFE"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="panel-header font-display font-semibold text-ink-900 mb-4">Talk-Time Leaderboard</h2>
          {!data.leaderboard.length ? (
            <EmptyState icon={PhoneCall} title="No calls yet" />
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.leaderboard.map((row, i) => (
                <div
                  key={row.assignee_id}
                  className="flex items-center gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
                >
                  <span className="text-sm font-semibold text-ink-300 w-4">{i + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-badge-indigo/10 text-badge-indigo flex items-center justify-center text-[11px] font-semibold shrink-0">
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

        <div className="card p-5">
          <h2 className="panel-header font-display font-semibold text-ink-900 mb-4">Minutes per Team Member</h2>
          {!data.minutes_per_member.length ? (
            <EmptyState icon={Clock} title="No calls yet" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.minutes_per_member} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="assignee_name"
                    width={90}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} min`, "Talk time"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
                  />
                  <Bar dataKey="talk_time_minutes" fill="#0D9488" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="panel-header font-display font-semibold text-ink-900 mb-4">Call Outcomes</h2>
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
                    contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="panel-header font-display font-semibold text-ink-900 mb-4">City Performance</h2>
          {!data.city_breakdown.length ? (
            <EmptyState icon={MapPinned} title="No city data yet" message="Add a city to your leads to see performance here." />
          ) : (
            <div className="overflow-x-auto scroll-shadow-x -mx-5">
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
          )}
        </div>

        <div className="card p-5">
          <h2 className="panel-header font-display font-semibold text-ink-900 mb-4">Product Performance</h2>
          {!data.product_breakdown.length ? (
            <EmptyState icon={Package} title="No orders logged yet" message="Order values from converted calls show up here." />
          ) : (
            <div className="overflow-x-auto scroll-shadow-x -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                    <th className="font-medium px-5 py-2">Product</th>
                    <th className="font-medium px-5 py-2">Orders</th>
                    <th className="font-medium px-5 py-2">Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.product_breakdown.map((p) => (
                    <tr key={p.product_id} className="border-t border-ink-100 hover:bg-bg/60">
                      <td className="px-5 py-3 font-medium text-ink-900">{p.product_name}</td>
                      <td className="px-5 py-3 text-ink-700">{p.orders_count}</td>
                      <td className="px-5 py-3 text-ink-700" title={formatCurrencyFull(p.order_value)}>
                        {formatCurrency(p.order_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
