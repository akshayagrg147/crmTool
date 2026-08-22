import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
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
  TrendingUp,
  UserCheck,
  UserRoundX,
  Users,
  WalletCards,
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

type Icon = typeof Users;
type Tone = "navy" | "gold" | "teal" | "plum";

function SectionHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-ink-900">{title}</h2>
        {detail && <p className="mt-1 text-xs leading-relaxed text-ink-500">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function DeltaBadge({ value }: { value?: number | null }) {
  if (value === undefined || value === null) return null;
  const positive = value >= 0;
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-bold ${positive ? "bg-secondary/10 text-secondary" : "bg-danger/10 text-danger"}`}><TrendingUp size={11} className={positive ? "" : "rotate-180"} />{positive ? "+" : ""}{value}%</span>;
}

function MetricCard({ label, value, detail, icon: IconComponent, tone, delta, to }: { label: string; value: string; detail: string; icon: Icon; tone: Tone; delta?: number | null; to: string }) {
  const toneStyles: Record<Tone, string> = { navy: "border-primary/15 bg-primary-soft text-primary", gold: "border-accent/20 bg-accent-soft text-accent-dark", teal: "border-secondary/15 bg-secondary/10 text-secondary", plum: "border-[#8D5572]/15 bg-[#F4ECEF] text-[#8D5572]" };
  return <Link to={to} className="group relative overflow-hidden rounded-[16px] border border-ink-100 bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card-hover sm:p-5"><div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" /><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-[10px] border ${toneStyles[tone]}`}><IconComponent size={17} /></span><ArrowUpRight size={15} className="text-ink-300 transition-colors group-hover:text-primary" /></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">{label}</p><div className="mt-1 flex flex-wrap items-end gap-2"><p className="font-serif text-[27px] font-semibold leading-none tracking-[-0.045em] text-ink-900">{value}</p><DeltaBadge value={delta} /></div><p className="mt-2 truncate text-xs text-ink-500">{detail}</p></Link>;
}

function QuickAction({ to, label, detail, value, icon: IconComponent, tone }: { to: string; label: string; detail: string; value: string; icon: Icon; tone: Tone }) {
  const iconStyles: Record<Tone, string> = { navy: "border-primary/15 bg-primary-soft text-primary", gold: "border-accent/25 bg-accent-soft text-accent-dark", teal: "border-secondary/20 bg-secondary/10 text-secondary", plum: "border-[#D5A6C2]/25 bg-[#F4ECEF] text-[#8D5572]" };
  return <Link to={to} className="group flex min-w-0 items-center gap-3 rounded-[13px] border border-ink-100 bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card sm:p-4"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border ${iconStyles[tone]}`}><IconComponent size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-ink-900">{label}</span><span className="mt-1 block truncate text-[10px] text-ink-500">{detail}</span></span><span className="flex shrink-0 items-center gap-1.5"><strong className="text-base font-bold text-ink-900">{value}</strong><ArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></span></Link>;
}

function PipelinePulse({ funnel, animateIn, totalLeads, converted }: { funnel: { stage: string; count: number }[]; animateIn: boolean; totalLeads: number; converted: number }) {
  const max = Math.max(...funnel.map((stage) => stage.count), 1);
  return <section className="rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><SectionHeader eyebrow="Pipeline pulse" title="Movement through the funnel" detail="A clear view of where the workspace is gaining momentum." action={<Link to="/analytics" className="btn-ghost px-2.5 py-1.5 text-xs">Full analytics <ArrowRight size={13} /></Link>} /><div className="mt-8 flex h-48 items-end gap-2 border-b border-ink-100 px-1 sm:gap-5">{funnel.map((stage, index) => <div key={stage.stage} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[11px] font-bold tabular-nums text-ink-700 opacity-0 transition-opacity group-hover:opacity-100">{stage.count.toLocaleString("en-IN")}</span><div className="relative flex h-full w-full max-w-14 items-end overflow-hidden rounded-t-[8px] bg-ink-50"><div className="w-full rounded-t-[8px] transition-[height] duration-700 ease-out" style={{ height: animateIn ? `${Math.max((stage.count / max) * 88, stage.count ? 8 : 2)}%` : "2%", transitionDelay: `${index * 90}ms`, background: index === 0 ? "linear-gradient(180deg,#315D85,#173A5E)" : index === 1 ? "linear-gradient(180deg,#627BA0,#4B5E88)" : index === 2 ? "linear-gradient(180deg,#4F8C87,#2F6F6D)" : "linear-gradient(180deg,#D2AB65,#B8893A)" }} /></div><span className="max-w-20 truncate text-[10px] font-semibold text-ink-500">{stage.stage.replace("Not Picked", "Not picked")}</span></div>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500"><span>Tracked across {totalLeads.toLocaleString("en-IN")} leads</span><span className="flex items-center gap-1.5 font-semibold text-secondary"><CheckCircle2 size={13} /> {converted.toLocaleString("en-IN")} converted this period</span></div></section>;
}

function AttentionQueue({ staleCount, overdueCount, unassigned }: { staleCount: number; overdueCount: number; unassigned: number }) {
  return <section className="rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><SectionHeader eyebrow="Attention queue" title="Work that needs a decision" detail="Keep the next action visible before it becomes a missed opportunity." /><div className="mt-6 space-y-2.5"><Link to="/leads?assignee=unassigned" className="group flex items-center gap-3 rounded-xl border border-accent/15 bg-accent-soft/55 p-3.5 transition-colors hover:bg-accent-soft"><span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent/10 text-accent-dark"><UserRoundX size={17} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-ink-900">Unassigned leads</strong><span className="mt-0.5 block text-[10px] text-ink-500">Ready for an owner</span></span><strong className="text-lg tabular-nums text-ink-900">{unassigned.toLocaleString("en-IN")}</strong><ArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5" /></Link><Link to="/follow-ups" className="group flex items-center gap-3 rounded-xl border border-danger/10 bg-danger/5 p-3.5 transition-colors hover:bg-danger/10"><span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-danger/10 text-danger"><Clock3 size={17} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-ink-900">Callbacks due</strong><span className="mt-0.5 block text-[10px] text-ink-500">Overdue follow-ups</span></span><strong className="text-lg tabular-nums text-ink-900">{overdueCount.toLocaleString("en-IN")}</strong><ArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5" /></Link><Link to="/leads?status=new" className="group flex items-center gap-3 rounded-xl border border-primary/10 bg-primary-soft/55 p-3.5 transition-colors hover:bg-primary-soft"><span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary"><AlertTriangle size={17} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-ink-900">Leads without activity</strong><span className="mt-0.5 block text-[10px] text-ink-500">Open longer than 48 hours</span></span><strong className="text-lg tabular-nums text-ink-900">{staleCount.toLocaleString("en-IN")}</strong><ArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5" /></Link></div></section>;
}

function SourceMix({ breakdown }: { breakdown: { source: LeadSource; count: number }[] }) {
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  const top = breakdown[0];
  return <section className="rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><SectionHeader eyebrow="Demand mix" title="Where leads come from" action={<Globe2 size={18} className="text-primary" />} />{!breakdown.length ? <EmptyState icon={Globe2} title="No lead sources yet" message="Connected sources will appear here." /> : <div className="mt-6 grid items-center gap-5 sm:grid-cols-[0.9fr_1.1fr]"><div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={breakdown} dataKey="count" nameKey="source" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="#FFFFFF" strokeWidth={2}>{breakdown.map((item) => <Cell key={item.source} fill={SOURCE_COLORS[item.source]} />)}</Pie><Tooltip formatter={(value: number, _name, entry: any) => [value, SOURCE_LABELS[entry.payload.source as LeadSource]]} contentStyle={{ borderRadius: 10, border: "1px solid #E1E3E2", boxShadow: "0 14px 34px -22px rgba(24,37,51,.32)" }} /></PieChart></ResponsiveContainer></div><div className="space-y-2.5">{breakdown.slice(0, 5).map((item) => <div key={item.source} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[item.source] }} /><span className="min-w-0 flex-1 truncate font-semibold text-ink-700">{SOURCE_LABELS[item.source]}</span><span className="font-bold text-ink-900">{total ? Math.round((item.count / total) * 100) : 0}%</span></div>)}<div className="border-t border-ink-100 pt-2.5 text-[10px] text-ink-400">Top source: <span className="font-bold text-ink-700">{top ? SOURCE_LABELS[top.source] : "—"}</span></div></div></div>}</section>;
}

function FollowUpDesk({ followUps, search, onSearch, isTelecaller }: { followUps: { id: string; name: string; phone: string; assignee_name: string | null; last_contacted_at: string | null; next_follow_up_at: string | null; is_overdue: boolean }[]; search: string; onSearch: (value: string) => void; isTelecaller: boolean }) {
  return <section className="rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><SectionHeader eyebrow="Next actions" title="Follow-up desk" action={<Link to="/follow-ups" className="btn-ghost px-2.5 py-1.5 text-xs">View all <ArrowRight size={13} /></Link>} />{!isTelecaller && <div className="relative mt-4"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input aria-label="Search follow ups by assignee" className="input py-2 pl-8 text-xs" placeholder="Search name or assignee..." value={search} onChange={(event) => onSearch(event.target.value)} /></div>}{!followUps.length ? <EmptyState icon={CheckCircle2} title="No follow-ups pending" message="New callbacks will appear here automatically." /> : <div className="mt-4 divide-y divide-ink-100">{followUps.slice(0, 6).map((item) => <Link to="/follow-ups" key={item.id} className="group flex items-center gap-3 py-3 first:pt-1 last:pb-1"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.is_overdue ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary"}`}>{initials(item.name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-sm text-ink-900">{item.name}</strong>{item.is_overdue && <span className="badge bg-danger/10 text-danger">Overdue</span>}</span><span className={`mt-1 flex items-center gap-1 text-xs ${item.is_overdue ? "font-semibold text-danger" : "text-ink-500"}`}><Clock3 size={11} />{item.next_follow_up_at ? `${item.is_overdue ? "Was due " : "Call back "}${formatCallbackTime(item.next_follow_up_at)}` : `${item.phone} · ${timeAgo(item.last_contacted_at)}`}</span></span><ArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></Link>)}</div>}</section>;
}

function TeamPulse({ rows, range, onRange, search, onSearch, stale }: { rows: { assignee_id: string; assignee_name: string; calls: number; talk_time_minutes: number }[]; range: "today" | "7d" | "all"; onRange: (range: "today" | "7d" | "all") => void; search: string; onSearch: (value: string) => void; stale: boolean }) {
  const maxCalls = Math.max(...rows.map((row) => row.calls), 1);
  return <section className={`rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card transition-opacity sm:p-6 ${stale ? "opacity-60" : ""}`}><SectionHeader eyebrow="Team pulse" title="Who is moving the work" /><div className="mt-4 flex flex-wrap gap-2"><div className="relative min-w-[180px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input aria-label="Search performance by assignee" className="input py-2 pl-8 text-xs" placeholder="Search team member..." value={search} onChange={(event) => onSearch(event.target.value)} /></div><div className="flex rounded-lg border border-ink-100 bg-[#F8F7F3] p-1" role="group" aria-label="Performance date range">{RANGE_OPTIONS.map((option) => <button type="button" key={option.value} aria-pressed={range === option.value} onClick={() => onRange(option.value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition-colors ${range === option.value ? "bg-primary text-white" : "text-ink-500 hover:text-ink-900"}`}>{option.label}</button>)}</div></div>{!rows.length ? <EmptyState icon={PhoneCall} title="No call activity yet" message="Logged calls will show team movement here." /> : <div className="mt-5 space-y-4">{rows.slice(0, 5).map((row) => <div key={row.assignee_id} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[11px] font-bold text-primary">{initials(row.assignee_name)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-ink-800">{row.assignee_name}</strong><span className="text-xs font-bold tabular-nums text-ink-700">{row.calls} calls</span></span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100"><span className="block h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.max((row.calls / maxCalls) * 100, row.calls ? 5 : 0)}%` }} /></span></span><span className="w-12 text-right text-[10px] font-semibold text-ink-400">{formatMinutes(row.talk_time_minutes)}</span></div>)}</div>}{rows.length > 5 && <Link to="/analytics" className="mt-5 flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark">Full performance report <ArrowRight size={13} /></Link>}</section>;
}

function RhythmCard({ callbacks, overdue }: { callbacks: number; overdue: number }) {
  return <section className="rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><SectionHeader eyebrow="Your rhythm" title="Stay close to the next call" action={<MessageCircle size={19} className="text-secondary" />} /><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-primary-soft p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-primary">My callbacks</p><p className="mt-2 font-serif text-3xl font-semibold text-primary-dark">{callbacks}</p></div><div className="rounded-xl bg-accent-soft p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-accent-dark">Overdue</p><p className="mt-2 font-serif text-3xl font-semibold text-accent-dark">{overdue}</p></div></div><Link to="/leads" className="btn-primary mt-5 w-full">Open my lead queue <ArrowRight size={15} /></Link></section>;
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
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return <div className="flex flex-col gap-6 pb-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-dark"><span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Operations / Dashboard</div><h1 className="page-title mt-2 text-[2.45rem] sm:text-[3rem]">Good morning, {firstName}.</h1><p className="page-subtitle max-w-2xl">A calm, precise view of the work that moves your business forward.</p></div><div className="flex flex-wrap gap-2"><Link to="/leads" className="btn-secondary text-sm"><Contact size={16} /> Lead queue</Link>{!isTelecaller && <Link to="/analytics" className="btn-primary text-sm"><BarChart3 size={16} /> View analytics</Link>}</div></div>
    <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-primary-dark p-5 text-white shadow-[0_24px_60px_-34px_rgba(14,41,66,0.9)] sm:p-7"><div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[44px] border-white/[0.035]" /><div className="absolute bottom-0 right-[28%] h-28 w-60 bg-[radial-gradient(ellipse_at_bottom,rgba(201,155,74,0.2),transparent_70%)]" /><div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-center"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-soft"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Workspace pulse <span className="text-white/30">·</span><span className="text-white/50">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</span></div><h2 className="mt-4 max-w-xl font-serif text-[2.25rem] font-semibold leading-[1.03] tracking-[-0.04em] sm:text-[3rem]">Pipeline health at a glance.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/60">See ownership, momentum, and customer intent before you open a single record.</p><div className="mt-6 flex flex-wrap gap-3"><Link to={isTelecaller ? "/leads" : "/leads?assignee=unassigned"} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-primary-dark transition-colors hover:bg-[#d6ac5f]">{isTelecaller ? "Open my queue" : "Review unassigned"} <ArrowRight size={15} /></Link><Link to="/follow-ups" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.12]">Follow-up desk <Clock3 size={15} /></Link></div></div><div className="flex items-center justify-start gap-5 rounded-[16px] border border-white/10 bg-white/[0.055] p-4 sm:p-5 lg:justify-center"><div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(#C99B4A ${conversionRate * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}><div className="absolute inset-3 flex flex-col items-center justify-center rounded-full border border-white/10 bg-primary-dark"><span className="text-2xl font-bold tracking-[-0.04em]">{conversionRate}%</span><span className="text-[10px] uppercase tracking-wide text-white/55">converted</span></div></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Conversion health</p><p className="mt-2 font-serif text-2xl font-semibold tracking-[-0.04em]">{data.kpis.converted.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-white/55">successful conversions</p><p className="mt-4 flex items-center gap-2 text-xs text-white/70"><span className="h-2 w-2 rounded-full bg-secondary" /> {formatCurrency(data.kpis.total_order_value)} order value</p></div></div></div><div className="relative z-10 mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-4"><div className="bg-primary-dark/35 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Total leads</p><p className="mt-1 text-lg font-bold text-white">{totalLeads.toLocaleString("en-IN")}</p></div><div className="bg-primary-dark/35 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Assigned</p><p className="mt-1 text-lg font-bold text-white">{assigned.toLocaleString("en-IN")}</p></div><div className="bg-primary-dark/35 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Unassigned</p><p className="mt-1 text-lg font-bold text-accent-soft">{unassigned.toLocaleString("en-IN")}</p></div><div className="bg-primary-dark/35 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Talk time</p><p className="mt-1 text-lg font-bold text-white">{formatMinutes(data.kpis.talk_time_minutes)}</p></div></div></section>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"><MetricCard label="Total leads" value={totalLeads.toLocaleString("en-IN")} detail="Across the workspace" icon={Users} tone="gold" delta={data.kpis.total_leads_delta} to="/leads" /><MetricCard label="Assigned" value={assigned.toLocaleString("en-IN")} detail="With an owner" icon={UserCheck} tone="navy" delta={data.kpis.assigned_delta} to="/leads" /><MetricCard label="Unassigned" value={unassigned.toLocaleString("en-IN")} detail="Needs assignment" icon={UserRoundX} tone="gold" to="/leads?assignee=unassigned" /><MetricCard label="Converted" value={data.kpis.converted.toLocaleString("en-IN")} detail={`${conversionRate}% conversion rate`} icon={CheckCircle2} tone="teal" delta={data.kpis.converted_delta} to="/leads?status=converted" /><MetricCard label="Order value" value={formatCurrency(data.kpis.total_order_value)} detail="From logged conversations" icon={IndianRupee} tone="plum" delta={data.kpis.total_order_value_delta} to="/analytics" /></div>
    {!isTelecaller && <div className="grid gap-3 md:grid-cols-3"><QuickAction to="/leads?assignee=unassigned" label="Unassigned work" detail="Leads waiting for an owner" value={unassigned.toLocaleString("en-IN")} icon={UserRoundX} tone="gold" /><QuickAction to="/follow-ups" label="Callbacks due" detail="Overdue and scheduled follow-ups" value={String(overdueCount)} icon={Clock3} tone="teal" /><QuickAction to="/lost-deals" label="Review lost deals" detail="Manager review and reasons" value="Open" icon={Target} tone="plum" /></div>}
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><PipelinePulse funnel={data.funnel} animateIn={animateIn} totalLeads={totalLeads} converted={data.kpis.converted} /><AttentionQueue staleCount={data.stale_leads.count} overdueCount={overdueCount} unassigned={unassigned} /></div>
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]"><SourceMix breakdown={data.source_breakdown} />{!isTelecaller ? <TeamPulse rows={filteredPerf} range={perfRange} onRange={setPerfRange} search={perfSearch} onSearch={setPerfSearch} stale={perfIsStale} /> : <RhythmCard callbacks={data.follow_ups.length} overdue={overdueCount} />}</div>
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]"><FollowUpDesk followUps={filteredFollowUps} search={followUpSearch} onSearch={setFollowUpSearch} isTelecaller={isTelecaller} /><section className="rounded-[18px] border border-ink-100 bg-surface p-5 shadow-card sm:p-6"><SectionHeader eyebrow="Latest movement" title="Recent leads" action={<Link to="/leads" className="btn-ghost px-2.5 py-1.5 text-xs">Open all leads <ArrowRight size={13} /></Link>} />{!data.recent_leads.length ? <EmptyState icon={Users} title="No leads yet" message="Add your first lead to get started." /> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="border-b border-ink-100 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400"><th className="pb-3 pr-4">Lead</th><th className="pb-3 pr-4">Source</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Owner</th><th className="pb-3 text-right">Added</th></tr></thead><tbody>{data.recent_leads.map((lead) => <tr key={lead.id} className="border-b border-ink-100 last:border-0"><td className="py-3.5 pr-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[10px] font-bold text-primary">{initials(lead.name)}</span><span className="min-w-0"><strong className="block max-w-[200px] truncate text-sm text-ink-900">{lead.name}</strong><span className="mt-0.5 block text-xs text-ink-500">{lead.phone}</span></span></div></td><td className="py-3.5 pr-4"><SourceBadge source={lead.source} /></td><td className="py-3.5 pr-4"><StatusBadge status={lead.status} /></td><td className="py-3.5 pr-4 text-ink-700">{lead.assignee_name ?? "Unassigned"}</td><td className="py-3.5 text-right text-xs text-ink-500">{timeAgo(lead.created_at)}</td></tr>)}</tbody></table></div>}</section></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-primary/10 bg-primary-soft/55 px-4 py-3 text-xs text-ink-600"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-secondary" /> Workspace data is isolated and role-protected.</span><span className="flex items-center gap-1.5 font-semibold text-primary"><WalletCards size={14} /> Data refreshed just now</span></div>
  </div>;
}

export default DashboardPageV2;
