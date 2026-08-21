import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCountUp } from "@/hooks/useCountUp";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  color: "orange" | "indigo" | "teal" | "pink";
  to?: string;
}

const colorClasses: Record<KpiCardProps["color"], string> = {
  orange: "bg-accent-soft text-accent-dark border-accent/15",
  indigo: "bg-primary-soft text-primary border-primary/10",
  teal: "bg-secondary/10 text-secondary border-secondary/10",
  pink: "bg-[#F4ECEF] text-[#7B5067] border-[#7B5067]/10",
};

export function KpiCard({ label, value, delta, icon: Icon, color, to }: KpiCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const animatedValue = useCountUp(value);

  const content = (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">{label}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${colorClasses[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="flex min-w-0 items-end justify-between gap-2">
        <p className="min-w-0 break-words text-[28px] font-bold leading-none tracking-[-0.035em] text-ink-900 tabular-nums sm:text-[30px]">
          {animatedValue}
        </p>
        {to && (
          <ArrowRight
            size={16}
            className="mb-1.5 text-ink-300 transition-colors duration-150 group-hover:text-primary"
          />
        )}
      </div>
      {delta !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <span className={`badge ${isPositive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-[11px] text-ink-400">vs previous period</span>
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="card-interactive group block cursor-pointer p-5 focus-ring"
      >
        {content}
      </Link>
    );
  }

  return <div className="card-interactive p-5 group">{content}</div>;
}
