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
  orange: "bg-badge-orange/10 text-badge-orange",
  indigo: "bg-badge-indigo/10 text-badge-indigo",
  teal: "bg-badge-teal/10 text-badge-teal",
  pink: "bg-badge-pink/10 text-badge-pink",
};

export function KpiCard({ label, value, delta, icon: Icon, color, to }: KpiCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const animatedValue = useCountUp(value);

  const content = (
    <>
      <div className="flex items-start justify-between mb-4">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ring-1 ring-inset ring-black/[0.04] ${colorClasses[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-[30px] leading-none font-bold text-ink-900 tabular-nums tracking-[-0.04em]">
          {animatedValue}
        </p>
        {to && (
          <ArrowRight
            size={16}
            className="text-ink-300 mb-1.5 opacity-0 -translate-x-1 transition-all duration-200 ease-smooth group-hover:opacity-100 group-hover:translate-x-0"
          />
        )}
      </div>
      {delta !== undefined && (
        <div className="mt-2">
          <span className={`badge ${isPositive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="card-interactive p-5 group block focus-ring cursor-pointer"
      >
        {content}
      </Link>
    );
  }

  return <div className="card-interactive p-5 group">{content}</div>;
}
