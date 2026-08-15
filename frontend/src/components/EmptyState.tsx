import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-in-up">
      <div className="h-14 w-14 rounded-full bg-ink-100 flex items-center justify-center mb-4 animate-scale-in">
        <Icon size={26} className="text-ink-300" />
      </div>
      <p className="font-semibold text-ink-900">{title}</p>
      {message && <p className="text-sm text-ink-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>{action}</div>}
    </div>
  );
}
