import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveX, CalendarDays, Phone, Search, Trash2, UserRound } from "lucide-react";
import { lostDealsApi, usersApi } from "@/api/endpoints";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableSkeleton } from "@/components/Spinner";
import { CategoryBadge, SourceBadge, StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatDate, timeAgo } from "@/lib/format";
import type { LostDealOut } from "@/api/types";

const PAGE_SIZE = 20;

export function LostDealsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [telecallerFilter, setTelecallerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<LostDealOut | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [search, telecallerFilter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page]);

  const filters = {
    q: search || undefined,
    telecaller_id: telecallerFilter || undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["lost-deals", filters],
    queryFn: () => lostDealsApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const { data: team } = useQuery({ queryKey: ["team"], queryFn: usersApi.list });
  const telecallers = useMemo(() => team?.filter((member) => member.role === "telecaller") ?? [], [team]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const visibleIds = data?.items.map((deal) => deal.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (!isPlaceholderData && data && page > 1 && data.items.length === 0) {
      setPage((current) => Math.max(1, current - 1));
    }
  }, [data, isPlaceholderData, page]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lostDealsApi.remove(id),
    onSuccess: (result, deletedId) => {
      setDeleteTarget(null);
      setSelectedIds((current) => current.filter((id) => id !== deletedId));
      toast(`${result.deleted} lost deal deleted`, "success");
      queryClient.invalidateQueries({ queryKey: ["lost-deals"] });
    },
    onError: () => toast("Couldn't delete this lost deal. Please try again.", "error"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => lostDealsApi.bulkRemove(ids),
    onSuccess: (result) => {
      setShowBulkDelete(false);
      setSelectedIds([]);
      toast(`${result.deleted} lost deals deleted`, "success");
      queryClient.invalidateQueries({ queryKey: ["lost-deals"] });
    },
    onError: () => toast("Couldn't delete the selected lost deals. Please try again.", "error"),
  });

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-1">Workspace / Review queue</p>
          <h1 className="text-2xl font-display font-semibold text-ink-900">Lost Deals</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {data ? `${data.total} lost ${data.total === 1 ? "deal" : "deals"}` : "Loading..."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isAdmin && (
            <button
              className="btn-secondary text-sm text-danger border-danger/20 hover:border-danger/40 hover:bg-danger/5"
              disabled={!selectedIds.length || bulkDeleteMutation.isPending}
              onClick={() => setShowBulkDelete(true)}
              title={selectedIds.length ? `Delete ${selectedIds.length} selected lost deals` : "Select lost deals to delete"}
            >
              <Trash2 size={16} /> Delete selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
            </button>
          )}
          <div className="rounded-xl border border-danger/15 bg-danger/5 px-3.5 py-2 text-xs text-danger flex items-center gap-2">
            <ArchiveX size={15} /> Review every lost-deal reason with the reporting telecaller.
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            className="input pl-8 py-2"
            placeholder="Search lost deals by name, phone, city..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select className="input py-2 w-auto" value={telecallerFilter} onChange={(event) => setTelecallerFilter(event.target.value)}>
          <option value="">All Telecallers</option>
          {telecallers.map((telecaller) => (
            <option key={telecaller.id} value={telecaller.id}>
              {telecaller.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={ArchiveX}
            title="No lost deals found"
            message="Lost deals reported by telecallers will appear here with their reason and attribution."
          />
        ) : (
          <div className={`overflow-x-auto scroll-shadow-x transition-opacity duration-200 ${isPlaceholderData ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                  {isAdmin && (
                    <th className="font-medium px-5 py-3 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary align-middle"
                        aria-label="Select all visible lost deals"
                        checked={allVisibleSelected}
                        onChange={toggleVisible}
                      />
                    </th>
                  )}
                  <th className="font-medium px-5 py-3">S.No.</th>
                  <th className="font-medium px-5 py-3">Lost On</th>
                  <th className="font-medium px-5 py-3">Lead</th>
                  <th className="font-medium px-5 py-3">Categories</th>
                  <th className="font-medium px-5 py-3">Reported By</th>
                  <th className="font-medium px-5 py-3">Manager</th>
                  <th className="font-medium px-5 py-3">Reason</th>
                  <th className="font-medium px-5 py-3">Source</th>
                  {isAdmin && <th className="font-medium px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((deal, index) => (
                  <tr key={deal.id} className="border-t border-ink-100 hover:bg-bg/60 transition-colors duration-150">
                    {isAdmin && (
                      <td className="px-5 py-3 w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary align-middle"
                          aria-label={`Select ${deal.name}`}
                          checked={selectedIds.includes(deal.id)}
                          onChange={() => toggleSelected(deal.id)}
                        />
                      </td>
                    )}
                    <td className="px-5 py-3 text-ink-500 tabular-nums">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-5 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {deal.lost_at ? (
                        <>
                          <p className="flex items-center gap-1.5 text-ink-700">
                            <CalendarDays size={13} /> {formatDate(deal.lost_at)}
                          </p>
                          <p className="mt-1">{timeAgo(deal.lost_at)}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 min-w-[210px]">
                      <p className="font-medium text-ink-900">{deal.name}</p>
                      <p className="text-xs text-ink-500 flex items-center gap-1.5 mt-1">
                        <Phone size={11} /> {deal.phone} {deal.city ? `· ${deal.city}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 min-w-[180px]">
                      <div className="flex flex-wrap gap-1.5">
                        {(deal.interested_categories?.length ? deal.interested_categories : [deal.category]).map((category) => (
                          <CategoryBadge key={category} category={category} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 min-w-[150px]">
                      <p className="flex items-center gap-1.5 text-ink-700">
                        <UserRound size={14} className="text-primary" /> {deal.lost_by_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-ink-400 mt-1">Telecaller</p>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{deal.assignee_name ?? "Unassigned"}</td>
                    <td className="px-5 py-3 min-w-[260px] max-w-[360px]">
                      <p className="text-ink-700 whitespace-normal leading-relaxed">{deal.lost_reason ?? "No reason recorded"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <SourceBadge source={deal.source} />
                      <div className="mt-1">
                        <StatusBadge status="lost" />
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          className="inline-flex items-center justify-center rounded-lg p-2 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                          aria-label={`Delete ${deal.name}`}
                          title="Delete lost deal"
                          disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}
                          onClick={() => setDeleteTarget(deal)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-ink-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete lost deal?"
        message={
          deleteTarget
            ? `Permanently delete “${deleteTarget.name}” and its call history? This action cannot be undone.`
            : "This action cannot be undone."
        }
        confirmLabel="Delete lost deal"
        isLoading={deleteMutation.isPending}
      />
      <ConfirmModal
        open={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        title="Delete selected lost deals?"
        message={`Permanently delete ${selectedIds.length} selected lost ${selectedIds.length === 1 ? "deal" : "deals"} and their call history? This action cannot be undone.`}
        confirmLabel="Delete selected"
        isLoading={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
