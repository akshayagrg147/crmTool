import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell, AlertTriangle, CalendarClock, Inbox } from "lucide-react";
import { analyticsApi } from "@/api/endpoints";
import { timeAgo } from "@/lib/format";

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: analyticsApi.dashboard,
    refetchInterval: 60_000,
  });

  const staleCount = data?.stale_leads.count ?? 0;
  const followUps = data?.follow_ups ?? [];
  const totalAlerts = staleCount + followUps.length;

  return (
    <div className="relative">
      <button
        className="p-2 rounded-full hover:bg-ink-100 text-ink-500 relative transition-all duration-200 active:scale-90"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {totalAlerts > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center animate-fade-in">
            {totalAlerts > 9 ? "9+" : totalAlerts}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 card p-0 z-20 shadow-popover origin-top-right animate-scale-in overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100">
              <p className="text-sm font-semibold text-ink-900">Notifications</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {totalAlerts === 0 ? (
                <div className="flex flex-col items-center text-center py-8 px-4">
                  <Inbox size={22} className="text-ink-300 mb-2" />
                  <p className="text-sm text-ink-500">You're all caught up</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-ink-100">
                  {staleCount > 0 && (
                    <Link
                      to="/leads"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-bg transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-warning/10 text-warning flex items-center justify-center shrink-0">
                        <AlertTriangle size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">
                          {staleCount} lead{staleCount > 1 ? "s" : ""} need attention
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5 truncate">
                          {data?.stale_leads.sample.join(", ")}
                        </p>
                      </div>
                    </Link>
                  )}
                  {followUps.map((f) => (
                    <Link
                      to="/leads?status=follow_up"
                      key={f.id}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-bg transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                        <CalendarClock size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">Follow up with {f.name}</p>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {f.assignee_name && `${f.assignee_name} · `}
                          {timeAgo(f.last_contacted_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
