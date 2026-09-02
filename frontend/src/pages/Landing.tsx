import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Headset,
  IndianRupee,
  KeyRound,
  Lock,
  MessagesSquare,
  Minus,
  PhoneCall,
  Plug,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
  UserRoundCog,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/BrandMark";
import { ProductTour } from "@/components/landing/ProductTour";
import { useAnimateIn } from "@/hooks/useAnimateIn";
import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";

const FEATURES = [
  {
    icon: Workflow,
    color: "indigo" as const,
    title: "Round-robin distribution",
    description: "Every new lead is handed to the next free telecaller automatically — nothing sits unassigned.",
  },
  {
    icon: PhoneCall,
    color: "teal" as const,
    title: "Call logging & follow-ups",
    description: "Log outcome, duration, and notes after every call, and schedule the next callback in seconds.",
  },
  {
    icon: Plug,
    color: "orange" as const,
    title: "IndiaMART & JustDial capture",
    description: "Connect your lead sources once — new enquiries flow in and get assigned without an Excel upload.",
  },
  {
    icon: ShieldCheck,
    color: "pink" as const,
    title: "Role-based access",
    description: "Admins, managers, and telecallers each see exactly what their role needs — nothing more.",
  },
  {
    icon: BarChart3,
    color: "indigo" as const,
    title: "Analytics that matter",
    description: "Talk time, conversion, call volume by hour, and team leaderboards — updated as calls come in.",
  },
  {
    icon: Tags,
    color: "teal" as const,
    title: "Categories you define",
    description: "Admins create the categories your business actually uses; telecallers pick from that list.",
  },
];

const ROLES = [
  {
    icon: Building2,
    title: "Admin",
    description: "Full control over the workspace.",
    points: ["Connect lead sources", "Manage the team & categories", "Export data, view every lead"],
  },
  {
    icon: UserRoundCog,
    title: "Manager",
    description: "Oversight without the noise.",
    points: ["Reassign and review leads", "Approve lost deals", "Track team performance"],
  },
  {
    icon: Headset,
    title: "Telecaller",
    description: "A focused calling queue.",
    points: ["My leads, my callbacks", "Log calls in one flow", "Update category & status"],
  },
];

const TRUST_STRIP = [
  { icon: Building2, label: "Multi-tenant by design" },
  { icon: ShieldCheck, label: "Role-based access control" },
  { icon: Zap, label: "Race-safe lead distribution" },
  { icon: KeyRound, label: "Encrypted integration credentials" },
];

const OPERATING_SIGNALS = [
  {
    icon: Route,
    label: "Lead intake",
    value: "Every enquiry has a route",
    detail: "IndiaMART · JustDial · CSV",
  },
  {
    icon: ShieldCheck,
    label: "Clear ownership",
    value: "Every lead has a person",
    detail: "Admin · manager · telecaller",
  },
  {
    icon: MessagesSquare,
    label: "Next action",
    value: "Every conversation has context",
    detail: "Calls · follow-ups · outcomes",
  },
];

const PRICING_PLANS = {
  6: { months: 6, monthlyPricePerUser: 399 },
  12: { months: 12, monthlyPricePerUser: 299 },
} as const;

type PricingTerm = keyof typeof PRICING_PLANS;

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INCLUDED_FEATURES = [
  "Lead distribution and ownership",
  "Call logs, notes, and follow-ups",
  "Admin, manager, and telecaller roles",
  "Categories, lost deals, and analytics",
  "CSV imports and connected lead sources",
  "Organization-level data separation",
];

/** Fades and lifts children in once they scroll into view; plays once. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
    </span>
  );
}

function PreviewPanel() {
  const ready = useAnimateIn();
  const assigned = useCountUp(ready ? "128" : "0", 1100);
  const converted = useCountUp(ready ? "34" : "0", 1100);
  const orderValue = useCountUp(ready ? "₹9.2L" : "₹0.0L", 1100);
  const bars = [38, 62, 44, 78, 55, 90, 70, 48];

  return (
    <div className="relative">
      <div
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent/25 blur-3xl animate-float-slow"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-primary-light/25 blur-3xl animate-float"
        aria-hidden="true"
      />

      <div className="relative rounded-[16px] border border-white/10 bg-white/[0.04] p-3 shadow-popover backdrop-blur-sm sm:p-4">
        <div className="rounded-[12px] border border-white/10 bg-[#0E2942] p-5">
          <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Today&apos;s queue</p>
            <p className="mt-1 font-serif text-lg font-semibold text-white">Team pipeline</p>
          </div>
            <div className="flex flex-col items-end gap-1">
              <span className="badge border-accent/25 bg-accent/15 text-accent-soft">
                <LiveDot />
                Live
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/30">Sample workspace</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[
              { label: "Assigned", value: assigned, icon: Workflow },
              { label: "Converted", value: converted, icon: TrendingUp },
              { label: "Order value", value: orderValue, icon: IndianRupee },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                <stat.icon size={14} className="text-accent-soft" />
                <p className="mt-2 text-lg font-bold leading-none tracking-tight text-white tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex h-20 items-end gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-accent/70 to-accent-soft/80"
                style={{
                  height: ready ? `${h}%` : "6%",
                  transition: `height 700ms cubic-bezier(0.16,1,0.3,1) ${180 + i * 55}ms`,
                }}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {[
              { name: "Priya Medical Stores", status: "Follow Up", tone: "text-accent-soft" },
              { name: "Dr. Rohan Mehta", status: "Converted", tone: "text-[#7FC9A8]" },
            ].map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
              >
                <span className="font-medium text-white/85">{row.name}</span>
                <span className={`font-semibold ${row.tone}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCalculator() {
  const [users, setUsers] = useState(10);
  const [term, setTerm] = useState<PricingTerm>(6);
  const plan = PRICING_PLANS[term];
  const monthlyTotal = users * plan.monthlyPricePerUser;
  const planTotal = monthlyTotal * plan.months;
  const planSavings =
    term === 12
      ? users * (PRICING_PLANS[6].monthlyPricePerUser - PRICING_PLANS[12].monthlyPricePerUser) * plan.months
      : 0;

  function updateUsers(next: number) {
    setUsers(Math.min(100, Math.max(1, next)));
  }

  return (
    <div className="grid overflow-hidden rounded-[18px] border border-primary/10 bg-surface shadow-popover lg:grid-cols-[0.92fr_1.08fr]">
      <div className="heritage-panel relative overflow-hidden p-6 text-white sm:p-9 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-[90px]" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-soft">
            <Sparkles size={13} aria-hidden="true" /> Flexible team plans
          </span>

          <div className="mt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Choose plan duration</p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Choose plan duration">
              {([6, 12] as const).map((months) => {
                const option = PRICING_PLANS[months];
                const selected = term === months;
                return (
                  <button
                    key={months}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTerm(months)}
                    className={`relative rounded-[10px] border px-3 py-3 text-left transition-colors ${
                      selected
                        ? "border-accent/70 bg-accent/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {months === 12 && (
                      <span className="absolute -right-1.5 -top-2 rounded-full bg-accent px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary-dark">
                        Best value
                      </span>
                    )}
                    <span className="block text-sm font-bold">{option.months} months</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-white/50">
                      {INR.format(option.monthlyPricePerUser)} / user / month
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-7 text-sm font-medium text-white/60">Per active CRM user</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <span className="font-serif text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
              {INR.format(plan.monthlyPricePerUser)}
            </span>
            <span className="pb-2 text-sm font-medium text-white/55">/ user / month</span>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            {term === 12
              ? `Choose the annual plan and save ${INR.format(PRICING_PLANS[6].monthlyPricePerUser - PRICING_PLANS[12].monthlyPricePerUser)} per user every month.`
              : "Start with the minimum 6-month commitment and pay only for the people who use Kelps Healthcare."}
          </p>

          <div className="mt-8 border-t border-white/10 pt-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Number of users</p>
                <p className="mt-1 text-sm font-semibold text-white">Choose your team size</p>
              </div>
              <div className="flex items-center rounded-[10px] border border-white/15 bg-white/[0.05] p-1">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
                  aria-label="Remove one user"
                  disabled={users === 1}
                  onClick={() => updateUsers(users - 1)}
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <input
                  aria-label="Number of CRM users"
                  className="w-14 border-0 bg-transparent text-center text-lg font-bold tabular-nums text-white outline-none"
                  type="number"
                  min={1}
                  max={100}
                  value={users}
                  onChange={(event) => updateUsers(Number(event.target.value) || 1)}
                />
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
                  aria-label="Add one user"
                  disabled={users === 100}
                  onClick={() => updateUsers(users + 1)}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <input
              aria-label="Select team size"
              className="mt-5 h-1.5 w-full cursor-pointer accent-[#B8893A]"
              type="range"
              min={1}
              max={100}
              value={users}
              onChange={(event) => updateUsers(Number(event.target.value))}
            />
            <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-white/35">
              <span>1 user</span>
              <span>100 users</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col p-6 sm:p-9 lg:p-10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary-soft text-primary">
            <Calculator size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-dark">Your estimate</p>
            <h3 className="mt-1 text-lg font-semibold text-ink-900">A predictable monthly cost</h3>
          </div>
        </div>

        <div className="mt-7 rounded-xl border border-ink-100 bg-[#F8F7F3] p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-ink-600"><UsersRound size={16} className="text-primary" aria-hidden="true" /> {users} active {users === 1 ? "user" : "users"}</span>
            <span className="font-medium text-ink-600">{INR.format(plan.monthlyPricePerUser)} each / month</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-ink-100 pt-4">
            <span className="text-sm font-semibold text-ink-700">Estimated monthly total</span>
            <span className="font-serif text-4xl font-semibold tracking-[-0.035em] text-primary-dark">{INR.format(monthlyTotal)}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-ink-100 pt-4 text-sm">
            <span className="text-ink-600">Full {plan.months}-month plan value</span>
            <span className="font-bold tabular-nums text-ink-900">{INR.format(planTotal)}</span>
          </div>
          {planSavings > 0 && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-secondary/15 bg-secondary/5 px-3 py-2.5 text-sm">
              <span className="font-medium text-secondary">Your 12-month savings</span>
              <span className="font-bold tabular-nums text-secondary">{INR.format(planSavings)}</span>
            </div>
          )}
        </div>

        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-400">Everything your team needs</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {INCLUDED_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm leading-5 text-ink-700">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <Link to="/login" className="btn-primary min-h-11 w-full text-[15px] sm:w-auto">
            Log in to your workspace
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <p className="mt-3 text-xs leading-5 text-ink-500">Need more than 100 users? Kelps Healthcare can support a custom rollout for larger teams.</p>
        </div>
      </div>
    </div>
  );
}

const featureColor: Record<"orange" | "indigo" | "teal" | "pink", string> = {
  orange: "bg-accent-soft text-accent-dark border-accent/15",
  indigo: "bg-primary-soft text-primary border-primary/10",
  teal: "bg-secondary/10 text-secondary border-secondary/10",
  pink: "bg-[#F4ECEF] text-[#7B5067] border-[#7B5067]/10",
};

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <BrandLogo size={36} subtitle="" />
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-600 md:flex" aria-label="Primary navigation">
            <a href="#features" className="transition-colors hover:text-primary-dark">
              Platform
            </a>
            <a href="#roles" className="transition-colors hover:text-primary-dark">
              For your team
            </a>
            <a href="#workflow" className="transition-colors hover:text-primary-dark">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-primary-dark">
              Pricing
            </a>
          </nav>
          <Link to="/login" className="btn-primary">
            Log in
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="heritage-panel relative overflow-hidden text-white">
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary-light/20 blur-[100px] animate-float-slow"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-[120px] animate-float"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
          <div className="animate-fade-in-up">
            <div className="mb-6 flex items-center gap-3">
              <span className="heritage-rule" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent-soft">
                Built for distribution & telecalling teams
              </span>
            </div>

            <h1 className="max-w-xl font-serif text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[3.2rem]">
              Every lead, every call, every order — in one disciplined workspace.
            </h1>

            <p className="mt-6 max-w-lg text-[15px] leading-7 text-white/70">
              Kelps Healthcare routes incoming leads to your team automatically, keeps a complete record of
              every call and follow-up, and gives admins, managers, and telecallers exactly the view
              they need to do their job well.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/login" className="btn-primary min-h-11 px-5 text-[15px]">
                Log in to your workspace
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="#features"
                className="inline-flex min-h-11 items-center gap-2 rounded-[9px] border border-white/15 px-5 text-[15px] font-semibold text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                Explore features
              </a>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6">
              {TRUST_STRIP.map((item) => (
                <span key={item.label} className="flex items-center gap-2 text-xs font-medium text-white/55">
                  <item.icon size={14} className="text-accent-soft" aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>

            <p className="mt-6 flex items-center gap-2 text-xs text-white/45">
              <Lock size={13} aria-hidden="true" />
              No public sign-up — your workspace is provisioned by your organization&apos;s administrator.
            </p>
          </div>

          <div className="animate-fade-in-up lg:pl-6" style={{ animationDelay: "120ms" }}>
            <PreviewPanel />
          </div>
        </div>

        <a
          href="#features"
          aria-label="Scroll to features"
          className="relative z-10 mx-auto mb-6 hidden h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors duration-150 hover:border-white/30 hover:text-white lg:flex animate-bounce"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </a>
      </section>

      <section id="workflow" className="relative z-20 bg-bg px-5 pb-5 pt-0 sm:px-8">
        <div className="mx-auto -mt-8 max-w-6xl">
          <div className="grid overflow-hidden rounded-[14px] border border-ink-100/90 bg-surface shadow-popover md:grid-cols-3">
            {OPERATING_SIGNALS.map((signal, index) => (
              <div
                key={signal.label}
                className={`flex items-center gap-3 px-5 py-4 sm:px-6 sm:py-5 ${index > 0 ? "border-t border-ink-100 md:border-l md:border-t-0" : ""}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/15 bg-accent-soft text-accent-dark">
                  <signal.icon size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">{signal.label}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink-900">{signal.value}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{signal.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="heritage-panel relative overflow-hidden text-white">
        <div
          className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-primary-light/15 blur-[110px] animate-float-slow"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl px-5 py-20 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="page-eyebrow justify-center">See it in action</p>
            <h2 className="max-w-2xl font-serif text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[2.3rem]">
              Watch how Kelps Healthcare runs your day.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-white/65">
              A live walkthrough of what happens from the moment a lead arrives to the moment it&apos;s
              closed — click a step to jump straight to it.
            </p>
          </Reveal>

          <Reveal delay={120} className="mt-10">
            <ProductTour />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="page-eyebrow justify-center">What you get</p>
          <h2 className="page-title mt-3">A calling desk that runs itself.</h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-500">
            Everything a distribution team needs to turn enquiries into orders, without the spreadsheets.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 70}>
              <div className="card-interactive h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${featureColor[feature.color]}`}>
                  <feature.icon size={19} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-500">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="roles" className="border-y border-ink-100/80 bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="page-eyebrow justify-center">Built around your team</p>
            <h2 className="page-title mt-3">Everyone gets the view they actually need.</h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {ROLES.map((role, i) => (
              <Reveal key={role.title} delay={i * 90}>
                <div className="card h-full p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/10 bg-primary-soft text-primary">
                    <role.icon size={19} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-ink-900">{role.title}</h3>
                  <p className="mt-1 text-sm text-ink-500">{role.description}</p>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {role.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-ink-700">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative overflow-hidden bg-bg px-5 py-20 sm:px-8 sm:py-24">
        <div className="pointer-events-none absolute -right-32 top-10 h-80 w-80 rounded-full bg-accent/10 blur-[110px]" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="page-eyebrow justify-center">Simple per-user pricing</p>
            <h2 className="page-title mt-3">Only pay as your team grows.</h2>
            <p className="mt-3 text-[15px] leading-7 text-ink-500">
              Start with a 6-month commitment or choose the 12-month plan for our best per-user rate.
            </p>
          </Reveal>
          <Reveal delay={100} className="mt-12">
            <PricingCalculator />
          </Reveal>
        </div>
      </section>

      <section className="heritage-panel relative overflow-hidden text-white">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/15 blur-[110px] animate-float-slow"
          aria-hidden="true"
        />
        <Reveal className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center sm:px-8">
          <span className="heritage-rule" aria-hidden="true" />
          <h2 className="max-w-xl font-serif text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.4rem]">
            Ready to bring order to your calling desk?
          </h2>
          <p className="max-w-md text-[15px] leading-7 text-white/65">
            Sign in with the details your administrator gave you to get straight to your queue.
          </p>
          <Link to="/login" className="btn-primary mt-2 min-h-11 px-6 text-[15px]">
            Log in to your workspace
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-ink-100/80 bg-bg">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <BrandLogo size={34} subtitle="Conversation-led CRM" />
              <p className="mt-4 max-w-xs text-sm leading-6 text-ink-500">
                A calm, accountable workspace for teams that turn enquiries into conversations and conversations into orders.
              </p>
            </div>
            <div>
              <p className="section-label">Platform</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-ink-600">
                <a href="#features" className="transition-colors hover:text-primary-dark">Features</a>
                <a href="#workflow" className="transition-colors hover:text-primary-dark">How it works</a>
                <a href="#roles" className="transition-colors hover:text-primary-dark">For your team</a>
                <a href="#pricing" className="transition-colors hover:text-primary-dark">Pricing</a>
              </div>
            </div>
            <div>
              <p className="section-label">Workspace</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-ink-600">
                <Link to="/login" className="transition-colors hover:text-primary-dark">Log in</Link>
                <span>Admin controls</span>
                <span>Lead operations</span>
              </div>
            </div>
            <div>
              <p className="section-label">Built for</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-ink-600">
                <span>Distribution teams</span>
                <span>Calling desks</span>
                <span>Growing operations</span>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-4 border-t border-ink-100 pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-xs text-ink-500">&copy; {new Date().getFullYear()} Kelps Healthcare. All rights reserved.</p>
            <p className="flex items-center gap-2 text-xs text-ink-400">
              <Lock size={13} aria-hidden="true" /> Access is provisioned by your organization&apos;s administrator.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
