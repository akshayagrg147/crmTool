import { ShieldAlert, Pill, Leaf, Droplet, Sparkles, Package, HelpCircle } from "lucide-react";
import type { LeadStatus, LeadSource, LeadCategory } from "@/api/types";

const statusStyles: Record<LeadStatus, string> = {
  new: "border-secondary/10 bg-secondary/10 text-secondary",
  follow_up: "border-warning/10 bg-warning/10 text-warning",
  not_picked: "border-ink-100 bg-ink-50 text-ink-500",
  converted: "border-success/10 bg-success/10 text-success",
  lost: "border-danger/10 bg-danger/10 text-danger",
};

const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  follow_up: "Follow Up",
  not_picked: "Not Picked",
  converted: "Converted",
  lost: "Lost",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge ${statusStyles[status]}`}>{statusLabels[status]}</span>;
}

const sourceLabels: Record<LeadSource, string> = {
  manual: "Manual",
  indiamart: "IndiaMART",
  justdial: "JustDial",
  tradeindia: "TradeIndia",
  website: "Website",
  referral: "Referral",
};

export function SourceBadge({ source }: { source: LeadSource }) {
  return <span className="badge border-primary/10 bg-primary-soft text-primary">{sourceLabels[source]}</span>;
}

const categoryConfig: Record<string, { label: string; icon: typeof Pill; className: string }> = {
  pharmaceutical: { label: "Pharmaceutical", icon: Pill, className: "bg-badge-indigo/10 text-badge-indigo" },
  ayurvedic: { label: "Ayurvedic", icon: Leaf, className: "bg-badge-teal/10 text-badge-teal" },
  homeopathic: { label: "Homeopathic", icon: Droplet, className: "bg-badge-orange/10 text-badge-orange" },
  nutraceutical: { label: "Nutraceutical", icon: Sparkles, className: "bg-badge-pink/10 text-badge-pink" },
  generic: { label: "Generic", icon: Package, className: "bg-badge-teal/10 text-badge-teal" },
  other: { label: "Other", icon: HelpCircle, className: "bg-ink-300/20 text-ink-500" },
};

export function CategoryBadge({ category }: { category: LeadCategory }) {
  const cfg =
    categoryConfig[category] ?? {
      label: category,
      icon: Package,
      className: "bg-primary/10 text-primary",
    };
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.className}`}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

export function DndBadge() {
  return (
    <span className="badge bg-danger/10 text-danger" title="Do-Not-Disturb — check calling-hours compliance before contacting">
      <ShieldAlert size={12} /> DND
    </span>
  );
}
