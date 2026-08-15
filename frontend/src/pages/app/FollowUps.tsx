import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MessageSquareText, Search, Phone, Clock } from "lucide-react";
import { followUpsApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCallbackTime, formatDate, formatMinutes, timeAgo } from "@/lib/format";
import type { LeadStatus } from "@/api/types";

const PAGE_SIZE = 20;

export function FollowUpsPage() {
  const { user } = useAuth();
  const isTelecaller = user?.role === "telecaller";

  const [search, setSearch] = useState("");
  const [telecallerFilter, setTelecallerFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<LeadStatus | "">("follow_up");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, telecallerFilter, outcomeFilter, dateFrom, dateTo]);

  const filters = {
    q: search || undefined,
    telecaller_id: isTelecaller ? undefined : telecallerFilter || undefined,
    outcome: outcomeFilter || undefined,
    date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["follow-ups", filters],
    queryFn: () => followUpsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: usersApi.list, enabled: !isTelecaller });
  const telecallers = team?.filter((t) => t.role === "telecaller") ?? [];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-display font-semibold text-ink-900">Follow-ups</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          {data ? `${data.total} follow-up ${data.total === 1 ? "message" : "messages"}` : "Loading..."}
        </p>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            className="input pl-8 py-2"
            placeholder="Search by lead name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input py-2 w-auto"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value as LeadStatus | "")}
        >
          <option value="">All Outcomes</option>
          <option value="follow_up">Follow Up</option>
          <option value="not_picked">Not Picked</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        {!isTelecaller && (
          <select className="input py-2 w-auto" value={telecallerFilter} onChange={(e) => setTelecallerFilter(e.target.value)}>
            <option value="">All Telecallers</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <input type="date" className="input py-2 w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-ink-300 text-sm">to</span>
        <input type="date" className="input py-2 w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="card">
        {isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={MessageSquareText}
            title="No follow-ups found"
            message="Follow-up messages logged against leads will show up here."
          />
        ) : (
          <div className={`divide-y divide-ink-100 transition-opacity duration-200 ${isPlaceholderData ? "opacity-60" : ""}`}>
            {data.items.map((f) => (
              <div key={f.id} className="px-5 py-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-badge-indigo/10 text-badge-indigo flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {f.lead_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-ink-900 text-sm">{f.lead_name}</p>
                      <p className="text-xs text-ink-500 flex items-center gap-1">
                        <Phone size={11} /> {f.lead_phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={f.outcome} />
                    <span className="text-xs text-ink-500">{formatMinutes(f.duration_minutes)}</span>
                  </div>
                </div>
                {f.notes && <p className="text-sm text-ink-700 pl-[42px]">{f.notes}</p>}
                {f.next_follow_up_at && (
                  <p className="text-xs text-warning pl-[42px] flex items-center gap-1">
                    <Clock size={11} /> Asked to call back {formatCallbackTime(f.next_follow_up_at)}
                  </p>
                )}
                <p className="text-xs text-ink-500 pl-[42px]">
                  {f.logged_by_name ?? "Unknown"} · {formatDate(f.created_at)} · {timeAgo(f.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-ink-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
