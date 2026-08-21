import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Headset,
  Plug,
  ShieldCheck,
  Tags,
  TrendingUp,
  UserRoundCog,
  Workflow,
} from "lucide-react";

const SCENE_DURATION_MS = 4200;

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  return reduced;
}

/** A small pill used inside every scene mockup — telecaller/source/status chips. */
function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success";
  className?: string;
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/30 bg-accent/15 text-accent-soft"
      : tone === "success"
        ? "border-[#7FC9A8]/30 bg-[#7FC9A8]/10 text-[#8FD6B7]"
        : "border-white/10 bg-white/[0.05] text-white/70";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass} ${className}`}>
      {children}
    </span>
  );
}

function SceneDistribution({ playKey }: { playKey: number }) {
  const telecallers = ["Tara", "Tanish", "Akshay"];
  const picked = playKey % telecallers.length;
  return (
    <div key={playKey} className="flex h-full flex-col justify-center gap-6 px-6 py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        New lead arrives &rarr; assigned automatically
      </p>
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <div className="animate-slide-in-left rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center">
          <p className="text-sm font-semibold text-white">Priya Medical Stores</p>
          <p className="mt-0.5 text-[11px] text-white/45">New enquiry</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-accent-soft">
          <Workflow size={20} className="animate-pulse-ring rounded-full" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/35">Round robin</span>
        </div>
        <div className="flex flex-col gap-2">
          {telecallers.map((name, i) => (
            <div
              key={name}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
                i === picked ? "border-accent/40 bg-accent/15" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {i === picked && (
                <CheckCircle2 size={13} className="animate-scale-in text-accent-soft" style={{ animationDelay: "900ms" }} />
              )}
              <span className={`text-xs font-medium ${i === picked ? "text-white" : "text-white/50"}`}>
                {name} Telecaller
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SceneCallLogging() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-6 py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        Log the call, schedule the next one
      </p>
      <div className="mx-auto flex w-full max-w-xs flex-col gap-3">
        <div className="flex gap-2">
          <span className="animate-scale-in rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-soft">
            Follow Up
          </span>
          <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/40">
            Not Picked
          </span>
        </div>
        <div
          className="animate-slide-in-right flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
          style={{ animationDelay: "500ms" }}
        >
          <CalendarClock size={15} className="text-accent-soft" aria-hidden="true" />
          <span className="text-xs text-white/80">Callback: Tomorrow, 10:00 AM</span>
        </div>
        <div
          className="animate-fade-in-up flex items-center gap-2 text-xs font-semibold text-[#8FD6B7]"
          style={{ animationDelay: "1400ms" }}
        >
          <Check size={14} aria-hidden="true" />
          Saved to call history
        </div>
      </div>
    </div>
  );
}

function SceneCapture() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-6 py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        Enquiries flow straight into your queue
      </p>
      <div className="mx-auto flex items-center gap-3">
        <Chip tone="accent" className="animate-pulse-ring">
          <Plug size={11} aria-hidden="true" /> IndiaMART
        </Chip>
        <Chip>
          <Plug size={11} aria-hidden="true" /> JustDial
        </Chip>
      </div>
      <div
        className="animate-slide-in-bottom mx-auto flex w-full max-w-xs items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2.5"
        style={{ animationDelay: "550ms" }}
      >
        <span className="text-xs font-medium text-white/85">Dr. Sneha Iyer</span>
        <span className="text-[11px] text-white/40">Bengaluru</span>
      </div>
      <p
        className="animate-fade-in-up text-center text-[11px] font-semibold text-accent-soft"
        style={{ animationDelay: "1300ms" }}
      >
        Auto-assigned to Tanish Telecaller — no upload needed
      </p>
    </div>
  );
}

function SceneAnalytics() {
  const bars = [42, 68, 50, 82, 60, 95, 74];
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-6 py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        Team performance, updated as calls happen
      </p>
      <div className="mx-auto flex h-16 w-full max-w-xs items-end justify-center gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-6 origin-bottom animate-scale-in rounded-sm bg-gradient-to-t from-accent/70 to-accent-soft/80"
            style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>
      <div
        className="animate-fade-in-up mx-auto flex w-full max-w-xs items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2"
        style={{ animationDelay: "700ms" }}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/80">
          <TrendingUp size={13} className="text-accent-soft" aria-hidden="true" /> Top: Tara Telecaller
        </span>
        <span className="text-xs font-bold text-white tabular-nums">3h 40m</span>
      </div>
    </div>
  );
}

function SceneRoles({ playKey }: { playKey: number }) {
  const roles = [
    { icon: Building2, name: "Admin", points: ["Connects lead sources", "Manages the whole team"] },
    { icon: UserRoundCog, name: "Manager", points: ["Reassigns leads", "Approves lost deals"] },
    { icon: Headset, name: "Telecaller", points: ["Sees only their queue", "Logs calls, updates category"] },
  ];
  const active = playKey % roles.length;
  const role = roles[active];
  return (
    <div key={playKey} className="flex h-full flex-col items-center justify-center gap-5 px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">One workspace, three views</p>
      <div className="flex gap-2">
        {roles.map((r, i) => (
          <span
            key={r.name}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              i === active ? "border-accent/40 bg-accent/15 text-accent-soft" : "border-white/10 text-white/40"
            }`}
          >
            {r.name}
          </span>
        ))}
      </div>
      <div className="animate-scale-in flex w-full max-w-xs flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-4">
        <div className="flex items-center gap-2">
          <role.icon size={16} className="text-accent-soft" aria-hidden="true" />
          <span className="text-sm font-semibold text-white">{role.name}</span>
        </div>
        {role.points.map((point, i) => (
          <p
            key={point}
            className="animate-fade-in-up flex items-center gap-2 text-xs text-white/70"
            style={{ animationDelay: `${300 + i * 250}ms` }}
          >
            <CheckCircle2 size={12} className="shrink-0 text-[#8FD6B7]" aria-hidden="true" />
            {point}
          </p>
        ))}
      </div>
    </div>
  );
}

function SceneCategories() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-6 py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        Admin defines it, the team uses it
      </p>
      <div className="mx-auto flex w-full max-w-xs flex-col gap-2.5">
        <div className="animate-slide-in-left flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
          <Tags size={13} className="text-accent-soft" aria-hidden="true" />
          <span className="text-xs font-semibold text-accent-soft">+ High Value created by Admin</span>
        </div>
        <div
          className="animate-fade-in-up flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2"
          style={{ animationDelay: "900ms" }}
        >
          <span className="text-xs text-white/80">Karan Distributors</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#8FD6B7]">
            <Check size={12} aria-hidden="true" /> Set to High Value
          </span>
        </div>
      </div>
    </div>
  );
}

const SCENES = [
  { id: "distribution", icon: Workflow, label: "Distribution", render: (k: number) => <SceneDistribution playKey={k} /> },
  { id: "calls", icon: Headset, label: "Call logging", render: () => <SceneCallLogging /> },
  { id: "capture", icon: Plug, label: "Lead capture", render: () => <SceneCapture /> },
  { id: "analytics", icon: BarChart3, label: "Analytics", render: () => <SceneAnalytics /> },
  { id: "roles", icon: ShieldCheck, label: "Role-based access", render: (k: number) => <SceneRoles playKey={k} /> },
  { id: "categories", icon: Tags, label: "Categories", render: () => <SceneCategories /> },
];

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [active]);

  // setInterval, not requestAnimationFrame: this is a multi-second scene
  // timer, not a per-frame visual sync, and rAF can be throttled hard
  // (backgrounded tabs, some automation/embedded contexts) in a way that
  // would silently stall the whole tour.
  useEffect(() => {
    if (paused || reducedMotion) return;
    const TICK_MS = 50;
    const id = window.setInterval(() => {
      elapsedRef.current += TICK_MS;
      const pct = Math.min((elapsedRef.current / SCENE_DURATION_MS) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        setActive((a) => (a + 1) % SCENES.length);
        setPlayKey((k) => k + 1);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [active, paused, reducedMotion]);

  function jumpTo(i: number) {
    setActive(i);
    setPlayKey((k) => k + 1);
  }

  const scene = SCENES[active];

  return (
    <div
      className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3 shadow-popover backdrop-blur-sm sm:p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-[13px] border border-white/10 bg-[#0E2942]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-white/15" aria-hidden="true" />
          <span className="h-2 w-2 rounded-full bg-white/15" aria-hidden="true" />
          <span className="h-2 w-2 rounded-full bg-white/15" aria-hidden="true" />
          <span className="ml-3 text-[11px] font-semibold text-white/35">TalkoCRM — {scene.label}</span>
        </div>
        <div className="min-h-[260px]">{scene.render(playKey)}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 px-1">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(i)}
            aria-label={`Show ${s.label}`}
            aria-current={i === active}
            className="group flex flex-1 basis-24 flex-col gap-1.5 rounded-lg px-1 py-1.5 text-left"
          >
            <span className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-accent"
                style={{
                  width: i < active ? "100%" : i === active ? `${progress}%` : "0%",
                }}
              />
            </span>
            <span
              className={`flex items-center gap-1.5 text-[10.5px] font-semibold transition-colors ${
                i === active ? "text-white" : "text-white/35 group-hover:text-white/60"
              }`}
            >
              <s.icon size={12} aria-hidden="true" />
              <span className="hidden sm:inline">{s.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
