import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  UploadCloud,
  Trash2,
  Search,
  Contact,
  PhoneCall,
  CalendarClock,
  Clock,
  PhoneMissed,
  CheckCircle2,
  MoreVertical,
  MessageCircle,
  AlertTriangle,
  Package,
  Pencil,
  Download,
  UserRoundX,
} from "lucide-react";
import { leadsApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DropdownMenu } from "@/components/DropdownMenu";
import { TableSkeleton } from "@/components/Spinner";
import { StatusBadge, SourceBadge, CategoryBadge, DndBadge } from "@/components/StatusBadge";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { BulkImportModal } from "@/components/leads/BulkImportModal";
import { CallLogModal } from "@/components/leads/CallLogModal";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { EditLeadModal } from "@/components/leads/EditLeadModal";
import { ProductManagerModal } from "@/components/leads/ProductManagerModal";
import { formatCallbackTime, initials, timeAgo, whatsappLink } from "@/lib/format";
import type { LeadCategory, LeadOut, LeadSource, LeadStatus } from "@/api/types";

const PAGE_SIZE = 15;

const CATEGORY_LABELS: Record<LeadCategory, string> = {
  pharmaceutical: "Pharmaceutical",
  ayurvedic: "Ayurvedic",
  homeopathic: "Homeopathic",
  nutraceutical: "Nutraceutical",
  generic: "Generic",
  other: "Other",
};

export function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isTelecaller = user?.role === "telecaller";

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "">("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">((searchParams.get("status") as LeadStatus) ?? "");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<LeadCategory | "">("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [callbackFilter, setCallbackFilter] = useState<"" | "scheduled" | "overdue">("");
  const [page, setPage] = useState(1);

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [callModalLead, setCallModalLead] = useState<LeadOut | null>(null);
  const [callModalOutcome, setCallModalOutcome] = useState<LeadStatus | undefined>();
  const [detailLead, setDetailLead] = useState<LeadOut | null>(null);
  const [editLead, setEditLead] = useState<LeadOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadOut | null>(null);
  const [menuLead, setMenuLead] = useState<LeadOut | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, statusFilter, assigneeFilter, categoryFilter, cityFilter, callbackFilter]);

  const filters = {
    q: search || undefined,
    source: sourceFilter || undefined,
    status: statusFilter || undefined,
    assigned_to: isTelecaller ? undefined : assigneeFilter || undefined,
    category: categoryFilter || undefined,
    city: cityFilter || undefined,
    has_callback: callbackFilter ? true : undefined,
    overdue_only: callbackFilter === "overdue" ? true : undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: usersApi.list, enabled: !isTelecaller });
  const telecallers = useMemo(() => team?.filter((t) => t.role === "telecaller") ?? [], [team]);

  const { data: usedCategories } = useQuery({ queryKey: ["lead-categories"], queryFn: leadsApi.usedCategories });
  const { data: usedCities } = useQuery({ queryKey: ["lead-cities"], queryFn: leadsApi.usedCities });

  const clearAllMutation = useMutation({
    mutationFn: leadsApi.clearAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lead-categories"] });
      toast("All leads cleared", "success");
      setShowClearAll(false);
    },
    onError: () => toast("Couldn't clear leads. Please try again.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lead-categories"] });
      toast("Lead deleted", "success");
      setDeleteTarget(null);
    },
    onError: () => toast("Couldn't delete the lead. Please try again.", "error"),
  });

  const canManage = user?.role === "admin" || user?.role === "manager";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function handleExport() {
    setExporting(true);
    try {
      const { page: _page, page_size: _pageSize, ...exportFilters } = filters;
      const blob = await leadsApi.exportCsv(exportFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Leads exported", "success");
    } catch {
      toast("Couldn't export leads. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-ink-900">{isTelecaller ? "My Leads" : "Leads"}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{data ? `${data.total} total leads` : "Loading..."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button className="btn-secondary text-sm" onClick={handleExport} disabled={exporting}>
                <Download size={16} /> {exporting ? "Exporting..." : "Export"}
              </button>
              <button className="btn-secondary text-sm" onClick={() => setShowProducts(true)}>
                <Package size={16} /> Products
              </button>
              <button className="btn-secondary text-sm" onClick={() => setShowClearAll(true)}>
                <Trash2 size={16} /> Clear All
              </button>
              <button className="btn-secondary text-sm" onClick={() => setShowBulk(true)}>
                <UploadCloud size={16} /> Bulk Import
              </button>
              <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add Lead
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            className="input pl-8 py-2"
            placeholder="Search by name, phone, city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchParams((p) => {
                if (e.target.value) p.set("q", e.target.value);
                else p.delete("q");
                return p;
              });
            }}
          />
        </div>
        <select className="input py-2 w-auto" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as LeadSource | "")}>
          <option value="">All Sources</option>
          <option value="manual">Manual</option>
          <option value="indiamart">IndiaMART</option>
          <option value="tradeindia">TradeIndia</option>
          <option value="website">Website</option>
          <option value="referral">Referral</option>
        </select>
        <select className="input py-2 w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}>
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="follow_up">Follow Up</option>
          <option value="not_picked">Not Picked</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        {!isTelecaller && (
          <select className="input py-2 w-auto" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">All Telecallers</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <select
          className="input py-2 w-auto"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as LeadCategory | "")}
        >
          <option value="">All Categories</option>
          {usedCategories?.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="input py-2 w-auto" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="">All Cities</option>
          {usedCities?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="input py-2 w-auto"
          value={callbackFilter}
          onChange={(e) => setCallbackFilter(e.target.value as "" | "scheduled" | "overdue")}
        >
          <option value="">All Leads</option>
          <option value="scheduled">Scheduled Callbacks (soonest first)</option>
          <option value="overdue">Overdue Callbacks</option>
        </select>
      </div>

      <div className="card">
        {isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={Contact}
            title="No leads found"
            message={canManage ? "Add a lead or adjust your filters." : "No leads assigned to you yet."}
            action={
              canManage ? (
                <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>
                  <Plus size={16} /> Add Lead
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className={`overflow-x-auto scroll-shadow-x transition-opacity duration-200 ${isPlaceholderData ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                  <th className="font-medium px-5 py-3">Lead</th>
                  <th className="font-medium px-5 py-3">Category</th>
                  <th className="font-medium px-5 py-3">Source</th>
                  {!isTelecaller && <th className="font-medium px-5 py-3">Assigned To</th>}
                  <th className="font-medium px-5 py-3">Status</th>
                  <th className="font-medium px-5 py-3">Last Call</th>
                  <th className="font-medium px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className="border-t border-ink-100 hover:bg-bg/60 transition-colors duration-150 animate-fade-in"
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <td className="px-5 py-3 cursor-pointer" onClick={() => setDetailLead(lead)}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-badge-indigo/10 text-badge-indigo flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {initials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-ink-900 truncate">{lead.name}</p>
                            {lead.dnd && <DndBadge />}
                            {lead.outstanding_amount != null &&
                              lead.credit_limit != null &&
                              lead.outstanding_amount > lead.credit_limit && (
                                <span
                                  className="badge bg-warning/10 text-warning"
                                  title="Outstanding exceeds credit limit"
                                >
                                  <AlertTriangle size={12} /> Over Credit
                                </span>
                              )}
                          </div>
                          <p className="text-xs text-ink-500">
                            {lead.phone} {lead.city && `· ${lead.city}`}
                            {lead.state && `, ${lead.state}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <CategoryBadge category={lead.category} />
                    </td>
                    <td className="px-5 py-3">
                      <SourceBadge source={lead.source} />
                    </td>
                    {!isTelecaller && (
                      <td className="px-5 py-3 text-ink-700">{lead.assignee_name ?? "Unassigned"}</td>
                    )}
                    <td className="px-5 py-3">
                      <StatusBadge status={lead.status} />
                      {lead.next_follow_up_at && (
                        <p
                          className={`flex items-center gap-1 text-[11px] mt-1 ${
                            new Date(lead.next_follow_up_at) < new Date() ? "text-danger font-medium" : "text-ink-500"
                          }`}
                        >
                          <Clock size={11} />
                          {new Date(lead.next_follow_up_at) < new Date()
                            ? "Pending — overdue"
                            : formatCallbackTime(lead.next_follow_up_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-500 text-xs">
                      {lead.last_call ? `${lead.last_call.outcome.replace("_", " ")} · ${timeAgo(lead.last_call.created_at)}` : "No calls yet"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          title="Chat on WhatsApp"
                          href={whatsappLink(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-full hover:bg-success/10 text-success"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle size={16} />
                        </a>
                        <button
                          title="Log Call"
                          className="p-1.5 rounded-full hover:bg-primary/10 text-primary"
                          onClick={() => {
                            setCallModalLead(lead);
                            setCallModalOutcome(undefined);
                          }}
                        >
                          <PhoneCall size={16} />
                        </button>
                        <button
                          title="More actions"
                          className="p-1.5 rounded-full hover:bg-ink-100 text-ink-500"
                          onClick={(e) => {
                            setMenuAnchor(e.currentTarget);
                            setMenuLead(menuLead?.id === lead.id ? null : lead);
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
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

      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} />
      <BulkImportModal open={showBulk} onClose={() => setShowBulk(false)} />
      <ProductManagerModal open={showProducts} onClose={() => setShowProducts(false)} />
      <CallLogModal
        open={!!callModalLead}
        onClose={() => setCallModalLead(null)}
        lead={callModalLead}
        defaultOutcome={callModalOutcome}
      />
      <LeadDetailModal
        open={!!detailLead}
        onClose={() => setDetailLead(null)}
        lead={detailLead}
        onEdit={
          canManage
            ? () => {
                setEditLead(detailLead);
                setDetailLead(null);
              }
            : undefined
        }
      />
      <EditLeadModal open={!!editLead} onClose={() => setEditLead(null)} lead={editLead} />
      <LeadActionsMenu
        open={!!menuLead}
        anchorEl={menuAnchor}
        lead={menuLead}
        telecallers={telecallers}
        canManage={canManage}
        onClose={() => setMenuLead(null)}
        onQuickOutcome={(outcome) => {
          if (!menuLead) return;
          setCallModalLead(menuLead);
          setCallModalOutcome(outcome);
        }}
        onEdit={() => {
          setEditLead(menuLead);
          setMenuLead(null);
        }}
        onDelete={() => {
          setDeleteTarget(menuLead);
          setMenuLead(null);
        }}
      />
      <ConfirmModal
        open={showClearAll}
        onClose={() => setShowClearAll(false)}
        onConfirm={() => clearAllMutation.mutate()}
        title="Clear all leads?"
        message="This permanently deletes every lead in your organization, including call history. Team members are not affected. This cannot be undone."
        confirmLabel="Clear All Leads"
        isLoading={clearAllMutation.isPending}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete this lead?"
        message={`This permanently deletes ${deleteTarget?.name} and their full call history. This cannot be undone.`}
        confirmLabel="Delete Lead"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function LeadActionsMenu({
  open,
  anchorEl,
  lead,
  telecallers,
  canManage,
  onClose,
  onQuickOutcome,
  onEdit,
  onDelete,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  lead: LeadOut | null;
  telecallers: { id: string; name: string }[];
  canManage: boolean;
  onClose: () => void;
  onQuickOutcome: (outcome: LeadStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reassignMutation = useMutation({
    mutationFn: (assignedTo: string | null) => leadsApi.reassign(lead!.id, assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast("Lead reassigned", "success");
      onClose();
    },
    onError: () => toast("Couldn't reassign the lead.", "error"),
  });

  if (!lead) return null;

  const itemClass = "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-bg text-ink-700 flex items-center gap-2.5";

  return (
    <DropdownMenu open={open} anchorEl={anchorEl} onClose={onClose}>
      <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-ink-500">Mark as</p>
      <button className={itemClass} onClick={() => { onQuickOutcome("follow_up"); onClose(); }}>
        <CalendarClock size={15} className="text-warning" /> Follow Up
      </button>
      <button className={itemClass} onClick={() => { onQuickOutcome("not_picked"); onClose(); }}>
        <PhoneMissed size={15} className="text-ink-500" /> Not Picked
      </button>
      <button className={itemClass} onClick={() => { onQuickOutcome("converted"); onClose(); }}>
        <CheckCircle2 size={15} className="text-success" /> Converted
      </button>

      {canManage && (
        <>
          <div className="h-px bg-ink-100 my-1" />
          <button className={itemClass} onClick={onEdit}>
            <Pencil size={15} /> Edit Lead
          </button>
          <div className="h-px bg-ink-100 my-1" />
          <p className="px-3 pt-1 pb-1 text-xs font-medium text-ink-500">Reassign to</p>
          <button className={itemClass} onClick={() => reassignMutation.mutate(null)}>
            <UserRoundX size={15} className="text-ink-500" /> Unassigned
          </button>
          {telecallers.map((t) => (
            <button key={t.id} className={itemClass} onClick={() => reassignMutation.mutate(t.id)}>
              {t.name}
            </button>
          ))}
          <div className="h-px bg-ink-100 my-1" />
          <button className={`${itemClass} text-danger hover:bg-danger/5`} onClick={onDelete}>
            <Trash2 size={15} /> Delete Lead
          </button>
        </>
      )}
    </DropdownMenu>
  );
}
