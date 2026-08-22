import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Contact,
  Globe2,
  IndianRupee,
  MessageCircle,
  PhoneCall,
  Search,
  ShieldCheck,
  Target,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { analyticsApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useAnimateIn } from "@/hooks/useAnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading } from "@/components/Spinner";
import { SourceBadge, StatusBadge } from "@/components/StatusBadge";
import { formatCallbackTime, formatCurrency, formatMinutes, initials, timeAgo } from "@/lib/format";
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
  { value: "7d", label: "7 days" },
  { value: "all", label: "All time" },
];

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: "navy" | "gold" | "teal" | "plum";
  to: string;
}) {
  const tones = {
    navy: "border-primary/10 bg-primary-soft text-primary",
    gold: "border-accent/15 bg-accent-soft text-accent-dark",
    teal: "border-secondary/15 bg-secondary/10 text-secondary",
    plum: "border-[#8D5572]/15 bg-[#F4ECEF] text-[#8D5572]",
  };

  return (
    <Link to={to} className="group rounded-[14px] border border-ink-100 bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card-hover sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon size={17} /></span>
        <ArrowUpRight size={15} className="text-ink-300 transition-colors group-hover:text-primary" />
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-[28px] font-semibold leading-none tracking-[-0.04em] text-ink-900">{value}</p>
      <p className="mt-2 truncate text-xs text-ink-500">{detail}</p>
    </Link>
  );
}

function ActionCard({
  to,
  label,
  detail,
  value,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  detail: string;
  value: string;
  icon: typeof Users;
  tone: "gold" | "teal" | "plum";
}) {
  const tones = {
    gold: "text-accent-soft bg-accent/10 border-accent/20",
    teal: "text-[#8FD6B7] bg-[#7FC9A8]/10 border-[#7FC9A8]/20",
    plum: "text-[#e0b9d0] bg-[#8D5572]/15 border-[#8D5572]/25",
  };

  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3 transition-colors hover:border-white/25 hover:bg-white/[0.08]">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">{label}</span><span className="mt-0.5 block truncate text-[10px] text-white/45">{detail}</span></span>
      <span className="flex shrink-0 items-center gap-1.5"><strong className="text-base text-white">{value}</strong><ArrowRight size={14} className="text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-white" /></span>
    </Link>
  );
}

function PipelineCard({ funnel, animateIn }: { funnel: { stage: string; count: number }[]; animateIn: boolean }) {
  const max = Math.max(...funnel.map((item) => item.count), 1);

  return (
    <section className="rounded-[16px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="page-eyebrow">Pipeline control</p><h2 className="mt-1 text-lg font-semibold text-ink-900">Where every lead stands</h2></div><Link to="/leads" className="btn-ghost px-2 py-1 text-xs">Open queue <ArrowRight size={13} /></Link></div>
      <div className="mt-7 space-y-4">
        {funnel.map((stage, index) => (
          <div key={stage.stage}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-ink-700">{stage.stage}</span><span className="font-bold tabular-nums text-ink-500">{stage.count.toLocaleString("en-IN")}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: animateIn ? `${Math.max((stage.count / max) * 100, stage.count ? 4 : 0)}%` : "0%", transitionDelay: `${index * 100}ms`, background: index === 0 ? "#173A5E" : index === 1 ? "#4B5E88" : index === 2 ? "#2F6F6D" : "#B8893A" }} /></div>
          </div>
        ))}
      </div>
      <div className="mt-7 grid grid-cols-3 gap-2 border-t border-ink-100 pt-4 text-center"><div><p className="text-lg font-bold text-ink-900">{funnel.find((stage) => stage.stage === "Assigned")?.count ?? 0}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Assigned</p></div><div><p className="text-lg font-bold text-ink-900">{funnel.find((stage) => stage.stage === "Contacted")?.count ?? 0}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Contacted</p></div><div><p className="text-lg font-bold text-ink-900">{funnel.find((stage) => stage.stage === "Converted")?.count ?? 0}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Converted</p></div></div>
    </section>
  );
}

export function DashboardPageV2() {
  const { user } = useAuth();
  const [followUpSearch, setFollowUpSearch] = useState("");
  const [perfRange, setPerfRange] = useState<"today" | "7d" | "all">("7d");
  const [perfSearch, setPerfSearch] = useState("");
  const isTelecaller = user?.role === "telecaller";

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: analyticsApi.dashboard });
  const { data: perfData, isPlaceholderData: perfIsStale } = useQuery({ queryKey: ["analytics", perfRange], queryFn: () => analyticsApi.analytics(perfRange), placeholderData: keepPreviousData });
  const animateIn = useAnimateIn(!isLoading && !!data);

  const filteredPerf = useMemo(() => {
    if (!perfData) return [];
    const query = perfSearch.trim().toLowerCase();
    return query ? perfData.minutes_per_member.filter((row) => row.assignee_name.toLowerCase().includes(query)) : perfData.minutes_per_member;
  }, [perfData, perfSearch]);
  const filteredFollowUps = useMemo(() => {
    if (!data) return [];
    const query = followUpSearch.trim().toLowerCase();
    return query ? data.follow_ups.filter((row) => row.assignee_name?.toLowerCase().includes(query) || row.name.toLowerCase().includes(query)) : data.follow_ups;
  }, [data, followUpSearch]);

  if (isLoading || !data) return <PageLoading />;

  const totalLeads = data.kpis.total_leads;
  const assigned = data.kpis.assigned;
  const unassigned = data.kpis.unassigned ?? Math.max(totalLeads - assigned, 0);
  const conversionRate = totalLeads ? Math.round((data.kpis.converted / totalLeads) * 100) : 0;
  const overdueCount = data.follow_ups.filter((item) => item.is_overdue).length;
  const sourceTotal = data.source_breakdown.reduce((sum, row) => sum + row.count, 0);
  const topSource = data.source_breakdown[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-dark"><span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Operations / Command center</div><h1 className="page-title mt-2 text-[2.5rem] sm:text-[3rem]">{isTelecaller ? "Your calling desk" : "Your team, in one clear view."}</h1><p className="page-subtitle max-w-2xl">{isTelecaller ? "A focused view of your next calls, follow-ups, and customer conversations." : "A composed view of ownership, pipeline movement, and the work that deserves attention today."}</p></div>
        <div className="flex flex-wrap gap-2"><Link to="/leads" className="btn-secondary text-sm"><Contact size={16} /> Lead queue</Link>{!isTelecaller && <Link to="/analytics" className="btn-primary text-sm"><BarChart3 size={16} /> View analytics</Link>}</div>
      </div>

      <section className="dashboard-hero relative overflow-hidden rounded-[18px] border border-white/10 p-5 text-white shadow-[0_24px_56px_-34px_rgba(14,41,66,0.85)] sm:p-7 lg:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-white/[0.035]" aria-hidden="true" /><div className="absolute bottom-0 right-[30%] h-24 w-48 bg-[radial-gradient(ellipse_at_bottom,rgba(201,155,74,0.15),transparent_70%)]" aria-hidden="true" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-soft"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}<span className="text-white/30">·</span><span className="text-white/50">{user?.name ?? "Workspace"}</span></div><h2 className="mt-4 max-w-xl font-serif text-[2.2rem] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[3rem]">{isTelecaller ? "Keep the next conversation moving." : "Make the important work impossible to miss."}</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/65">{isTelecaller ? "Your priority queue puts overdue callbacks and call-pending leads first." : "TalkoCRM brings every lead, owner, and next action into one operating picture for your team."}</p><div className="mt-7 flex flex-wrap gap-3"><Link to={isTelecaller ? "/leads" : "/leads?assignee=unassigned"} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-primary-dark transition-colors hover:bg-[#d6ac5f]">{isTelecaller ? "Open my queue" : "Review unassigned"} <ArrowRight size={15} /></Link><Link to="/follow-ups" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.12]">Follow-up desk <Clock3 size={15} /></Link></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2"><div className="rounded-xl border border-white/10 bg-white/[0.055] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Total leads</p><p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-white">{totalLeads.toLocaleString("en-IN")}</p><p className="mt-1 text-[11px] text-white/45">Across this workspace</p></div><div className="rounded-xl border border-white/10 bg-white/[0.055] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Unassigned</p><p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-accent-soft">{unassigned.toLocaleString("en-IN")}</p><p className="mt-1 text-[11px] text-white/45">Ready for an owner</p></div><div className="rounded-xl border border-white/10 bg-white/[0.055] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Converted</p><p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-[#8FD6B7]">{data.kpis.converted.toLocaleString("en-IN")}</p><p className="mt-1 text-[11px] text-white/45">{conversionRate}% conversion rate</p></div><div className="rounded-xl border border-white/10 bg-white/[0.055] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Order value</p><p className="mt-2 break-words font-serif text-2xl font-semibold tracking-[-0.04em] text-white">{formatCurrency(data.kpis.total_order_value)}</p><p className="mt-1 text-[11px] text-white/45">From logged calls</p></div></div></div>
      </section>

      {!isTelecaller && <section className="rounded-[16px] bg-primary-dark p-4 shadow-[0_18px_50px_-35px_rgba(14,41,66,0.9)] sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-accent-soft">Action rail</p><p className="mt-1 text-sm font-semibold text-white">The three things worth opening first</p></div><span className="hidden text-xs text-white/40 sm:block">Live workspace signals</span></div><div className="grid gap-2 sm:grid-cols-3"><ActionCard to="/leads?assignee=unassigned" label="Unassigned work" detail="Leads waiting for an owner" value={unassigned.toLocaleString("en-IN")} icon={UserRoundX} tone="gold" /><ActionCard to="/follow-ups" label="Callbacks due" detail="Overdue and scheduled follow-ups" value={String(overdueCount)} icon={Clock3} tone="teal" /><ActionCard to="/lost-deals" label="Review lost deals" detail="Manager review and reasons" value={data.kpis.converted === 0 ? "Open" : "Review"} icon={Target} tone="plum" /></div></section>}

      {data.stale_leads.count > 0 && <Link to="/leads?status=new" className="group flex items-start gap-3 rounded-[14px] border border-warning/20 bg-accent-soft/65 p-4 transition-colors hover:bg-accent-soft"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning"><AlertTriangle size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-ink-900">{data.stale_leads.count.toLocaleString("en-IN")} leads need attention</strong><span className="mt-1 block truncate text-xs text-ink-500">Open for more than 48 hours without a call · {data.stale_leads.sample.join(", ")}{data.stale_leads.count > data.stale_leads.sample.length ? "…" : ""}</span></span><ArrowUpRight size={17} className="mt-1 shrink-0 text-warning transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Total leads" value={totalLeads.toLocaleString("en-IN")} detail="All workspace leads" icon={Users} tone="gold" to="/leads" /><Metric label="Assigned" value={assigned.toLocaleString("en-IN")} detail="With an owner" icon={UserCheck} tone="navy" to="/leads" /><Metric label="Unassigned" value={unassigned.toLocaleString("en-IN")} detail="Needs assignment" icon={UserRoundX} tone="gold" to="/leads?assignee=unassigned" /><Metric label="Converted" value={data.kpis.converted.toLocaleString("en-IN")} detail={`${conversionRate}% conversion rate`} icon={CheckCircle2} tone="teal" to="/leads?status=converted" /><Metric label="Talk time" value={formatMinutes(data.kpis.talk_time_minutes)} detail="Logged conversations" icon={PhoneCall} tone="plum" to="/analytics" /><Metric label="Order value" value={formatCurrency(data.kpis.total_order_value)} detail="From call outcomes" icon={IndianRupee} tone="teal" to="/analytics" /></div>

      <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]"><PipelineCard funnel={data.funnel} animateIn={animateIn} /><section className="rounded-[16px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="page-eyebrow">Demand mix</p><h2 className="mt-1 text-lg font-semibold text-ink-900">Where leads come from</h2></div><Globe2 size={18} className="text-primary" /></div>{!data.source_breakdown.length ? <EmptyState icon={Globe2} title="No lead sources yet" message="Connected sources will appear here." /> : <div className="mt-5 grid items-center gap-5 sm:grid-cols-[0.9fr_1.1fr]"><div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.source_breakdown} dataKey="count" nameKey="source" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="#FFFFFF" strokeWidth={2}>{data.source_breakdown.map((source) => <Cell key={source.source} fill={SOURCE_COLORS[source.source]} />)}</Pie><Tooltip formatter={(value: number, _name, entry: any) => [value, SOURCE_LABELS[entry.payload.source as LeadSource]]} contentStyle={{ borderRadius: 10, border: "1px solid #E1E3E2", boxShadow: "0 14px 34px -22px rgba(24,37,51,.32)" }} /></PieChart></ResponsiveContainer></div><div className="space-y-2.5">{data.source_breakdown.slice(0, 5).map((source) => { const percent = sourceTotal ? Math.round((source.count / sourceTotal) * 100) : 0; return <div key={source.source} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[source.source] }} /><span className="min-w-0 flex-1 truncate font-semibold text-ink-700">{SOURCE_LABELS[source.source]}</span><span className="font-bold text-ink-900">{percent}%</span></div>; })}<div className="border-t border-ink-100 pt-2.5 text-[10px] text-ink-400">Top source: <span className="font-bold text-ink-700">{topSource ? SOURCE_LABELS[topSource.source] : "—"}</span></div></div></div>}</section></div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]"><section className="rounded-[16px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="page-eyebrow">Next actions</p><h2 className="mt-1 text-lg font-semibold text-ink-900">Follow-up desk</h2></div><Link to="/follow-ups" className="btn-ghost px-2 py-1 text-xs">View all <ArrowRight size={13} /></Link></div>{!isTelecaller && <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input aria-label="Search follow ups by assignee" className="input py-2 pl-8 text-xs" placeholder="Search name or assignee..." value={followUpSearch} onChange={(event) => setFollowUpSearch(event.target.value)} /></div>}{!filteredFollowUps.length ? <EmptyState icon={CheckCircle2} title="No follow-ups pending" message="New callbacks will appear here automatically." /> : <div className="divide-y divide-ink-100">{filteredFollowUps.slice(0, 6).map((followUp) => <Link to="/follow-ups" key={followUp.id} className="group flex items-center gap-3 py-3 first:pt-1 last:pb-1"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${followUp.is_overdue ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary"}`}>{initials(followUp.name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-sm text-ink-900">{followUp.name}</strong>{followUp.is_overdue && <span className="badge bg-danger/10 text-danger">Overdue</span>}</span><span className={`mt-1 flex items-center gap-1 text-xs ${followUp.is_overdue ? "font-semibold text-danger" : "text-ink-500"}`}><Clock3 size={11} />{followUp.next_follow_up_at ? (followUp.is_overdue ? "Was due " : "Call back ") + formatCallbackTime(followUp.next_follow_up_at) : `${followUp.phone} · ${timeAgo(followUp.last_contacted_at)}`}</span></span><ArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></Link>)}</div>}</section>

        {!isTelecaller ? <section className="rounded-[16px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="page-eyebrow">Team pulse</p><h2 className="mt-1 text-lg font-semibold text-ink-900">Who is moving the work</h2></div><div className="flex rounded-lg border border-ink-100 bg-[#F8F7F3] p-1" role="group" aria-label="Performance date range">{RANGE_OPTIONS.map((option) => <button type="button" key={option.value} aria-pressed={perfRange === option.value} onClick={() => setPerfRange(option.value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition-colors ${perfRange === option.value ? "bg-primary text-white" : "text-ink-500 hover:text-ink-900"}`}>{option.label}</button>)}</div></div><div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input aria-label="Search performance by assignee" className="input py-2 pl-8 text-xs" placeholder="Search team member..." value={perfSearch} onChange={(event) => setPerfSearch(event.target.value)} /></div>{!filteredPerf.length ? <EmptyState icon={PhoneCall} title="No call activity yet" message="Logged calls will show team movement here." /> : <div className={`space-y-3 transition-opacity ${perfIsStale ? "opacity-60" : ""}`}>{filteredPerf.slice(0, 5).map((row, index) => { const maxCalls = Math.max(...filteredPerf.map((member) => member.calls), 1); return <div key={row.assignee_id} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[11px] font-bold text-primary">{initials(row.assignee_name)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-ink-800">{row.assignee_name}</strong><span className="text-xs font-bold tabular-nums text-ink-700">{row.calls} calls</span></span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100"><span className="block h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.max((row.calls / maxCalls) * 100, row.calls ? 5 : 0)}%` }} /></span></span><span className="w-12 text-right text-[10px] font-semibold text-ink-400">{formatMinutes(row.talk_time_minutes)}</span></div>; })}</div>}{filteredPerf.length > 5 && <Link to="/analytics" className="mt-5 flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark">Full performance report <ArrowRight size={13} /></Link>}</section> : <section className="rounded-[16px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="page-eyebrow">Your rhythm</p><h2 className="mt-1 text-lg font-semibold text-ink-900">Stay close to the next call</h2></div><MessageCircle size={19} className="text-secondary" /></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-primary-soft p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-primary">My callbacks</p><p className="mt-2 font-serif text-3xl font-semibold text-primary-dark">{data.follow_ups.length}</p></div><div className="rounded-xl bg-accent-soft p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-accent-dark">Overdue</p><p className="mt-2 font-serif text-3xl font-semibold text-accent-dark">{overdueCount}</p></div></div><Link to="/leads" className="btn-primary mt-5 w-full">Open my lead queue <ArrowRight size={15} /></Link></section>}</div>

      <section className="rounded-[16px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="page-eyebrow">Latest movement</p><h2 className="mt-1 text-lg font-semibold text-ink-900">Recent leads</h2></div><Link to="/leads" className="btn-ghost px-2 py-1 text-xs">Open all leads <ArrowRight size={13} /></Link></div>{!data.recent_leads.length ? <EmptyState icon={Users} title="No leads yet" message="Add your first lead to get started." /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-ink-100 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400"><th className="pb-3 pr-4">Lead</th><th className="pb-3 pr-4">Source</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Owner</th><th className="pb-3 text-right">Added</th></tr></thead><tbody>{data.recent_leads.map((lead) => <tr key={lead.id} className="border-b border-ink-100 last:border-0 hover:bg-[#FAFAF7]"><td className="py-3.5 pr-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[10px] font-bold text-primary">{initials(lead.name)}</span><span className="min-w-0"><strong className="block max-w-[220px] truncate text-sm text-ink-900">{lead.name}</strong><span className="mt-0.5 block text-xs text-ink-500">{lead.phone}</span></span></div></td><td className="py-3.5 pr-4"><SourceBadge source={lead.source} /></td><td className="py-3.5 pr-4"><StatusBadge status={lead.status} /></td><td className="py-3.5 pr-4 text-ink-700">{lead.assignee_name ?? "Unassigned"}</td><td className="py-3.5 text-right text-xs text-ink-500">{timeAgo(lead.created_at)}</td></tr>)}</tbody></table></div>}</section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-primary/10 bg-primary-soft/55 px-4 py-3 text-xs text-ink-600"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-secondary" /> Workspace data is isolated and role-protected.</span><span className="font-semibold text-primary">{sourceTotal.toLocaleString("en-IN")} source records tracked</span></div>
    </div>
  );
}

export default DashboardPageV2;
