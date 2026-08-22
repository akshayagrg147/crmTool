import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Headset,
  IndianRupee,
  Layers3,
  Menu,
  MessageCircle,
  Minus,
  PhoneCall,
  PlugZap,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandMark";


const WORKFLOWS = [
  {
    number: "01",
    icon: PlugZap,
    title: "Capture every enquiry",
    body: "Bring IndiaMART, JustDial, imports, and manual leads into one reliable intake stream.",
    tone: "gold",
  },
  {
    number: "02",
    icon: Workflow,
    title: "Give it an owner",
    body: "Keep ownership explicit with unassigned queues, manager handoffs, and controlled distribution.",
    tone: "blue",
  },
  {
    number: "03",
    icon: Headset,
    title: "Make the next call",
    body: "Every conversation carries its notes, category, outcome, and next callback with it.",
    tone: "teal",
  },
  {
    number: "04",
    icon: TrendingUp,
    title: "See what is moving",
    body: "Turn activity into a clear view of conversion, talk time, order value, and team health.",
    tone: "plum",
  },
] as const;

const ROLE_VIEWS = [
  {
    role: "Admin",
    eyebrow: "Command",
    title: "The whole operation, without the clutter.",
    body: "Set the rules, manage people and categories, connect lead sources, and keep the data clean.",
    points: ["Workspace and team controls", "Lead source integrations", "Bulk tools and reporting"],
    icon: Layers3,
  },
  {
    role: "Manager",
    eyebrow: "Coach",
    title: "A live view of where the team needs you.",
    body: "Spot unassigned work, review lost deals, reassign with context, and coach from real activity.",
    points: ["Unassigned queue visibility", "Assignment history", "Lost-deal review"],
    icon: Target,
  },
  {
    role: "Telecaller",
    eyebrow: "Focus",
    title: "A queue that tells you what to do next.",
    body: "Overdue callbacks first, then call-pending leads, with the customer record one click away.",
    points: ["Priority calling queue", "Fast call logging", "Manager handoff"],
    icon: Headset,
  },
] as const;

const FAQS = [
  {
    question: "Can we keep new leads unassigned until a manager reviews them?",
    answer: "Yes. TalkoCRM keeps new leads unassigned by default. Admins and managers can assign a single lead, assign a selection, or explicitly run round-robin distribution when they are ready.",
  },
  {
    question: "What happens when a telecaller marks a lead as lost?",
    answer: "The lead is routed to a manager with the telecaller's reason and assignment history attached, so the team can review the decision without losing context.",
  },
  {
    question: "Is pricing based on the number of leads?",
    answer: "No. Plans are priced per active CRM user. Choose a six-month term at ₹399 per user per month or a twelve-month term at ₹299 per user per month.",
  },
  {
    question: "Do admins and managers see the same things?",
    answer: "No. Access is role-based. Admins control the workspace, managers run the operation, and telecallers see the calling queue and actions relevant to their own leads.",
  },
] as const;

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type PlanTerm = 6 | 12;

function Signal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l border-ink-100 pl-4 first:border-l-0 first:pl-0 sm:pl-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">{label}</p>
      <p className="font-serif text-2xl font-semibold tracking-[-0.035em] text-ink-900 sm:text-[28px]">{value}</p>
      <p className="truncate text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function ProductCanvas() {
  const bars = [42, 64, 51, 79, 58, 91, 73, 86];
  const rows = [
    { name: "Karan Distributors", meta: "IndiaMART · Jaipur", status: "Follow up", tone: "gold" },
    { name: "Priya Medical Stores", meta: "Manual · Mumbai", status: "New", tone: "blue" },
    { name: "Dr. Rohan Mehta", meta: "JustDial · Delhi", status: "Converted", tone: "teal" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[590px]">
      <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-[80px]" aria-hidden="true" />
      <div className="absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-secondary/20 blur-[90px]" aria-hidden="true" />

      <div className="relative rounded-[22px] border border-white/15 bg-[#0b2238] p-2 shadow-[0_30px_90px_-30px_rgba(14,41,66,0.8)] sm:p-3">
        <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#102f4b]">
          <div className="flex h-12 items-center gap-3 border-b border-white/10 px-4 sm:px-5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-[#DA8077]" />
              <span className="h-2 w-2 rounded-full bg-[#C99B4A]" />
              <span className="h-2 w-2 rounded-full bg-[#71B88E]" />
            </div>
            <div className="hidden h-7 flex-1 items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-[10px] text-white/35 sm:flex">
              app.talkocrm.com / command-center
            </div>
            <span className="ml-auto flex items-center gap-2 text-[10px] font-semibold text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7FC9A8]" /> Live workspace
            </span>
          </div>

          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
                  <h3 className="mt-1 font-serif text-xl font-semibold tracking-[-0.025em] text-white">Good morning, Akshay.</h3>
                  <p className="mt-1 text-xs text-white/45">Here is what needs your attention today.</p>
                </div>
                <span className="hidden rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent-soft sm:inline-flex">Command center</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[{ label: "Open", value: "1,249" }, { label: "Pending", value: "86" }, { label: "Won", value: "218" }].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">{stat.label}</p>
                    <p className="mt-1 text-lg font-bold tracking-tight text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white/80">Pipeline movement</p>
                    <p className="mt-0.5 text-[10px] text-white/35">Last 7 days</p>
                  </div>
                  <BarChart3 size={15} className="text-accent-soft" aria-hidden="true" />
                </div>
                <div className="mt-4 flex h-[98px] items-end gap-1.5 border-b border-white/10 px-1">
                  {bars.map((height, index) => (
                    <div key={index} className="flex h-full flex-1 items-end">
                      <div className="w-full rounded-t-sm bg-gradient-to-t from-accent/75 to-[#f0d69e]" style={{ height: `${height}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[9px] font-medium text-white/30"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white/80">Today&apos;s queue</p>
                  <p className="mt-0.5 text-[10px] text-white/35">Next best actions</p>
                </div>
                <span className="rounded-md bg-[#7FC9A8]/10 px-2 py-1 text-[10px] font-semibold text-[#8FD6B7]">12 due</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {rows.map((row) => (
                  <div key={row.name} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold text-white/85">{row.name}</p>
                      <span className={`shrink-0 text-[9px] font-bold ${row.tone === "gold" ? "text-accent-soft" : row.tone === "teal" ? "text-[#8FD6B7]" : "text-[#a9c6df]"}`}>{row.status}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-white/35">{row.meta}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] font-semibold text-accent-soft">
                <MessageCircle size={13} aria-hidden="true" /> Open all follow-ups <ArrowUpRight size={12} aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ role, active, onSelect }: { role: (typeof ROLE_VIEWS)[number]; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={active} className={`w-full rounded-[14px] border p-4 text-left transition-all duration-200 ${active ? "border-accent/40 bg-white/[0.09] shadow-[0_16px_40px_-30px_rgba(201,155,74,0.8)]" : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${active ? "border-accent/30 bg-accent/15 text-accent-soft" : "border-white/10 bg-white/[0.05] text-white/45"}`}><role.icon size={16} aria-hidden="true" /></span>
        <span className="min-w-0"><span className={`block text-[10px] font-bold uppercase tracking-[0.16em] ${active ? "text-accent-soft" : "text-white/35"}`}>{role.eyebrow}</span><span className="mt-0.5 block text-sm font-semibold text-white">{role.role}</span></span>
        <ChevronRight size={15} className={`ml-auto transition-transform ${active ? "translate-x-0.5 text-accent-soft" : "text-white/25"}`} aria-hidden="true" />
      </div>
    </button>
  );
}

function PricingBlock() {
  const [term, setTerm] = useState<PlanTerm>(6);
  const [users, setUsers] = useState(10);
  const monthlyPrice = term === 6 ? 399 : 299;
  const monthly = monthlyPrice * users;
  const total = monthly * term;

  return (
    <div className="grid overflow-hidden rounded-[20px] border border-ink-100 bg-surface shadow-[0_24px_70px_-45px_rgba(24,37,51,0.5)] lg:grid-cols-[0.95fr_1.05fr]">
      <div className="heritage-panel p-6 text-white sm:p-9">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-soft"><Sparkles size={13} aria-hidden="true" /> Predictable pricing</div>
        <h3 className="mt-5 max-w-sm font-serif text-3xl font-semibold leading-tight tracking-[-0.03em]">One clear price for every person doing the work.</h3>
        <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">Choose your commitment, enter your active team size, and see the number before you talk to anyone.</p>
        <div className="mt-8 grid grid-cols-2 gap-2" role="group" aria-label="Choose plan term">
          {([6, 12] as const).map((months) => (
            <button key={months} type="button" aria-pressed={term === months} onClick={() => setTerm(months)} className={`rounded-xl border p-3 text-left transition-colors ${term === months ? "border-accent/60 bg-accent/15" : "border-white/10 bg-white/[0.04] hover:border-white/25"}`}>
              <span className="block text-sm font-bold text-white">{months} months</span>
              <span className="mt-1 block text-[11px] text-white/50">{INR.format(months === 6 ? 399 : 299)} / user / month</span>
              {months === 12 && <span className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-dark">Best value</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6 sm:p-9">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-dark">Your estimate</p><p className="mt-1 text-lg font-semibold text-ink-900">{users} active {users === 1 ? "user" : "users"}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-primary-soft text-primary"><IndianRupee size={18} aria-hidden="true" /></div></div>
        <div className="mt-7 rounded-xl border border-ink-100 bg-[#F8F7F3] p-5" aria-live="polite"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-ink-400">Estimated monthly total</p><p className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary-dark">{INR.format(monthly)}</p><div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 text-sm"><span className="text-ink-500">Full {term}-month commitment</span><span className="font-bold text-ink-900">{INR.format(total)}</span></div></div>
        <div className="mt-6 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-ink-900">Team size</p><p className="mt-1 text-xs text-ink-500">Adjust active users</p></div><div className="flex items-center rounded-lg border border-ink-100 p-1"><button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-primary-soft disabled:opacity-30" onClick={() => setUsers(Math.max(1, users - 1))} disabled={users === 1} aria-label="Remove one user"><Minus size={15} /></button><span className="w-9 text-center text-sm font-bold tabular-nums text-ink-900">{users}</span><button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-primary-soft disabled:opacity-30" onClick={() => setUsers(Math.min(100, users + 1))} disabled={users === 100} aria-label="Add one user"><Plus size={15} /></button></div></div>
        <input className="mt-5 h-1.5 w-full cursor-pointer accent-[#B8893A]" type="range" min={1} max={100} value={users} onChange={(event) => setUsers(Number(event.target.value))} aria-label="Select team size" />
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-ink-400"><span>1 user</span><span>100 users</span></div>
        <Link to="/login" className="btn-primary mt-7 min-h-11 w-full">Open your workspace <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}

export function LandingPageV2() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const role = ROLE_VIEWS[activeRole];
  const navLinks = useMemo(() => [
    { href: "#platform", label: "Platform" },
    { href: "#workflow", label: "How it works" },
    { href: "#roles", label: "For your team" },
    { href: "#pricing", label: "Pricing" },
  ], []);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-ink-900">
      <div className="bg-primary-dark px-5 py-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/65 sm:text-xs">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" /> TalkoCRM · A clearer operating desk for high-intent teams
      </div>

      <header className="sticky top-0 z-50 border-b border-ink-100/80 bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" aria-label="TalkoCRM home"><BrandLogo size={38} subtitle="" /></Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-ink-500 lg:flex" aria-label="Primary navigation">
            {navLinks.map((item) => <a key={item.href} href={item.href} className="transition-colors hover:text-primary-dark">{item.label}</a>)}
          </nav>
          <div className="hidden items-center gap-3 sm:flex"><a href="#pricing" className="btn-ghost">See pricing</a><Link to="/login" className="btn-primary">Open workspace <ArrowRight size={15} /></Link></div>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-100 bg-surface text-ink-700 lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
        {mobileOpen && <div className="border-t border-ink-100 bg-surface px-5 py-4 lg:hidden"><nav className="flex flex-col gap-1" aria-label="Mobile navigation">{navLinks.map((item) => <a key={item.href} href={item.href} onClick={closeMobile} className="rounded-lg px-3 py-3 text-sm font-semibold text-ink-700 hover:bg-primary-soft">{item.label}</a>)}<Link to="/login" onClick={closeMobile} className="btn-primary mt-2">Open workspace <ArrowRight size={15} /></Link></nav></div>}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-ink-100/80 bg-bg">
          <div className="pointer-events-none absolute -right-28 -top-24 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[110px]" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-[360px] w-[360px] rounded-full bg-primary/10 blur-[100px]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16 lg:pb-28">
            <div className="animate-fade-in-up">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-dark"><Sparkles size={13} /> Built for the work behind every order</div>
              <h1 className="max-w-[660px] font-serif text-[3.3rem] font-semibold leading-[0.98] tracking-[-0.045em] text-primary-dark sm:text-[4.65rem] lg:text-[5.35rem]">The calm way to run a high-volume calling desk.</h1>
              <p className="mt-7 max-w-xl text-[16px] leading-7 text-ink-500 sm:text-[17px]">TalkoCRM gives your team one place to capture demand, make ownership visible, keep every conversation in context, and turn activity into a better decision.</p>
              <div className="mt-9 flex flex-wrap items-center gap-3"><Link to="/login" className="btn-primary min-h-12 px-5 text-[15px]">Enter your workspace <ArrowRight size={17} /></Link><a href="#platform" className="btn-secondary min-h-12 px-5 text-[15px]">See the operating model <ChevronDown size={16} /></a></div>
              <div className="mt-8 flex items-center gap-3 text-xs text-ink-500"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/10 text-secondary"><ShieldCheck size={14} /></span><span>No public sign-up · role-based access · workspace data stays separated</span></div>
            </div>
            <div className="animate-fade-in-up lg:pt-5" style={{ animationDelay: "120ms" }}><ProductCanvas /></div>
          </div>
        </section>

        <section className="border-b border-ink-100 bg-surface">
          <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:py-9"><Signal label="Leads in one queue" value="12.6K" detail="Imported, connected, or created" /><Signal label="Ownership" value="100%" detail="Every lead has a clear state" /><Signal label="Built for" value="3 roles" detail="Admin · manager · telecaller" /><Signal label="Next action" value="Always visible" detail="Callback, outcome, or handoff" /></div>
        </section>

        <section id="platform" className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-end"><div><p className="page-eyebrow">The operating model</p><h2 className="page-title mt-4 max-w-lg text-[2.5rem] sm:text-[3.35rem]">Less chasing. More control over the next move.</h2></div><p className="max-w-xl text-[16px] leading-7 text-ink-500 lg:pb-1">The best CRM is not the one with the most screens. It is the one that makes the important state obvious when the day gets busy.</p></div>
          <div id="workflow" className="mt-12 grid gap-px overflow-hidden rounded-[18px] border border-ink-100 bg-ink-100 sm:grid-cols-2 lg:grid-cols-4">{WORKFLOWS.map((item) => <div key={item.number} className="group bg-surface p-6 transition-colors hover:bg-[#FBFAF6] sm:p-7"><div className="flex items-center justify-between"><span className="font-mono text-xs font-bold tracking-[0.2em] text-ink-300">{item.number}</span><span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${item.tone === "gold" ? "border-accent/20 bg-accent-soft text-accent-dark" : item.tone === "teal" ? "border-secondary/15 bg-secondary/10 text-secondary" : item.tone === "plum" ? "border-[#8D5572]/15 bg-[#F4ECEF] text-[#8D5572]" : "border-primary/10 bg-primary-soft text-primary"}`}><item.icon size={18} /></span></div><h3 className="mt-8 text-lg font-semibold text-ink-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-ink-500">{item.body}</p><div className="mt-7 h-px w-7 bg-ink-200 transition-all duration-300 group-hover:w-14 group-hover:bg-accent" /></div>)}</div>
        </section>

        <section id="roles" className="heritage-panel relative overflow-hidden text-white"><div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-accent/10 blur-[110px]" aria-hidden="true" /><div className="relative mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-28"><div className="grid gap-12 lg:grid-cols-[0.68fr_1.32fr] lg:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-soft">One system, three working views</p><h2 className="mt-4 max-w-md font-serif text-[2.6rem] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[3.5rem]">Designed around responsibility, not hierarchy.</h2><p className="mt-5 max-w-md text-[15px] leading-7 text-white/60">Everyone sees the information they need to do the next useful thing, while leaders keep the complete picture.</p><div className="mt-8 space-y-2">{ROLE_VIEWS.map((item, index) => <RoleCard key={item.role} role={item} active={activeRole === index} onSelect={() => setActiveRole(index)} />)}</div></div><div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5 sm:p-8"><div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-soft">{role.eyebrow} view</p><h3 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-4xl">{role.title}</h3></div><div className="hidden h-12 w-12 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-soft sm:flex"><role.icon size={22} /></div></div><p className="mt-6 max-w-xl text-[15px] leading-7 text-white/60">{role.body}</p><ul className="mt-8 grid gap-3 sm:grid-cols-3">{role.points.map((point) => <li key={point} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-sm text-white/80"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#8FD6B7]" />{point}</li>)}</ul><div className="mt-8 grid gap-3 border-t border-white/10 pt-7 sm:grid-cols-3"><div className="rounded-xl bg-white/[0.045] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Visibility</p><p className="mt-2 text-xl font-semibold text-white">Clear</p><p className="mt-1 text-xs text-white/40">No hidden ownership</p></div><div className="rounded-xl bg-white/[0.045] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Context</p><p className="mt-2 text-xl font-semibold text-white">Connected</p><p className="mt-1 text-xs text-white/40">Calls stay with the lead</p></div><div className="rounded-xl bg-white/[0.045] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Action</p><p className="mt-2 text-xl font-semibold text-white">Immediate</p><p className="mt-1 text-xs text-white/40">The next step is clear</p></div></div></div></div></div></section>

        <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-28"><div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center"><div><p className="page-eyebrow">A product people can trust</p><h2 className="page-title mt-4 max-w-xl text-[2.5rem] sm:text-[3.35rem]">Professional enough for the boardroom. Practical enough for the calling floor.</h2><p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-500">TalkoCRM turns the details that usually disappear between a spreadsheet and a phone call into an operating rhythm your team can repeat.</p><div className="mt-8 grid max-w-xl gap-4 sm:grid-cols-2"><div className="rounded-[14px] border border-ink-100 bg-surface p-5 shadow-card"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><PhoneCall size={18} /></div><h3 className="mt-5 text-base font-semibold text-ink-900">Conversation memory</h3><p className="mt-2 text-sm leading-6 text-ink-500">Notes, outcomes, callbacks, and order details are attached to the customer record.</p></div><div className="rounded-[14px] border border-ink-100 bg-surface p-5 shadow-card"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-dark"><ShieldCheck size={18} /></div><h3 className="mt-5 text-base font-semibold text-ink-900">Safe by default</h3><p className="mt-2 text-sm leading-6 text-ink-500">Role boundaries, organization isolation, and assignment history protect the process.</p></div></div></div><div className="relative rounded-[20px] border border-ink-100 bg-[#F8F7F3] p-6 sm:p-8"><div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-secondary/15 bg-secondary/10 px-2.5 py-1 text-[10px] font-bold text-secondary"><span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Healthy workspace</div><div className="pt-10"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">At a glance</p><div className="mt-6 space-y-4"><div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-ink-700">Lead ownership</span><span className="font-bold text-secondary">100%</span></div><div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full w-full rounded-full bg-secondary" /></div></div><div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-ink-700">Callbacks completed</span><span className="font-bold text-primary">78%</span></div><div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full w-[78%] rounded-full bg-primary" /></div></div><div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-ink-700">Conversion motion</span><span className="font-bold text-accent-dark">64%</span></div><div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full w-[64%] rounded-full bg-accent" /></div></div></div><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-xl border border-ink-100 bg-surface p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Queue health</p><p className="mt-2 text-xl font-bold text-ink-900">Good</p><p className="mt-1 text-xs text-ink-500">12 priority callbacks</p></div><div className="rounded-xl border border-ink-100 bg-surface p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Team pulse</p><p className="mt-2 text-xl font-bold text-ink-900">+18%</p><p className="mt-1 text-xs text-ink-500">vs previous period</p></div></div></div></div></div></section>

        <section id="pricing" className="border-y border-ink-100 bg-[#F0F1EE] px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-[1080px]"><div className="mx-auto max-w-2xl text-center"><p className="page-eyebrow justify-center">Clear economics</p><h2 className="page-title mt-4 text-[2.5rem] sm:text-[3.25rem]">Start with the team you have. Grow without surprises.</h2><p className="mt-4 text-[16px] leading-7 text-ink-500">Every plan includes the operating model. The number changes with active users, not lead volume.</p></div><div className="mt-12"><PricingBlock /></div></div></section>

        <section className="mx-auto max-w-[920px] px-5 py-20 sm:px-8 sm:py-28"><div className="text-center"><p className="page-eyebrow justify-center">Questions, answered</p><h2 className="page-title mt-4 text-[2.45rem] sm:text-[3.2rem]">A serious tool should be easy to understand.</h2></div><div className="mt-10 divide-y divide-ink-100 rounded-[16px] border border-ink-100 bg-surface px-5 sm:px-7">{FAQS.map((faq, index) => { const open = openFaq === index; return <div key={faq.question}><button type="button" className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open} onClick={() => setOpenFaq(open ? null : index)}><span className="text-sm font-semibold text-ink-900 sm:text-[15px]">{faq.question}</span><ChevronDown size={17} className={`shrink-0 text-ink-400 transition-transform ${open ? "rotate-180 text-primary" : ""}`} /></button>{open && <div className="max-w-3xl pb-5 pr-8 text-sm leading-6 text-ink-500">{faq.answer}</div>}</div>; })}</div></section>

        <section className="heritage-panel relative overflow-hidden text-white"><div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-[110px]" aria-hidden="true" /><div className="relative mx-auto flex max-w-[1280px] flex-col items-start gap-7 px-5 py-20 sm:px-8 sm:py-24 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-3"><span className="h-px w-10 bg-accent" /><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-soft">Ready when your team is</span></div><h2 className="mt-5 max-w-2xl font-serif text-[2.8rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[4rem]">Make the next conversation count.</h2><p className="mt-5 max-w-lg text-[15px] leading-7 text-white/60">Your workspace already has the roles, the lead data, and the discipline. Give it a clearer operating surface.</p></div><Link to="/login" className="btn-primary min-h-12 shrink-0 px-6 text-[15px]">Open TalkoCRM <ArrowUpRight size={17} /></Link></div></section>
      </main>

      <footer className="border-t border-ink-100 bg-bg"><div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between"><div><BrandLogo size={35} subtitle="Conversation-led CRM" /><p className="mt-4 max-w-sm text-sm leading-6 text-ink-500">A calm, accountable workspace for teams that turn enquiries into conversations and conversations into orders.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-ink-500"><a href="#platform" className="hover:text-primary-dark">Platform</a><a href="#workflow" className="hover:text-primary-dark">How it works</a><a href="#pricing" className="hover:text-primary-dark">Pricing</a><Link to="/login" className="hover:text-primary-dark">Log in</Link></div><p className="text-xs text-ink-400">© {new Date().getFullYear()} TalkoCRM</p></div></footer>
    </div>
  );
}

export default LandingPageV2;
