import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Pencil,
  Download,
  UserRoundX,
  ArchiveX,
  Tags,
  Shuffle,
  GitMerge,
  Bookmark,
  ArrowUpRight,
  SlidersHorizontal,
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
import { EditLeadModal } from "@/components/leads/EditLeadModal";
import { MarkLostModal } from "@/components/leads/MarkLostModal";
import { CategoryManagerModal } from "@/components/leads/CategoryManagerModal";
import { ChangeCategoryModal } from "@/components/leads/ChangeCategoryModal";
import { MergeLeadModal } from "@/components/leads/MergeLeadModal";
import { SaveLeadViewModal, type SavedLeadView } from "@/components/leads/SaveLeadViewModal";
import { formatCallbackTime, formatDate, formatDateTime, initials, whatsappLink } from "@/lib/format";
import type { LeadCategory, LeadOut, LeadSource, LeadStatus } from "@/api/types";

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isTelecaller = user?.role === "telecaller";

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "">("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">((searchParams.get("status") as LeadStatus) ?? "");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(searchParams.get("assignee") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<LeadCategory | "">("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [callbackFilter, setCallbackFilter] = useState<"" | "scheduled" | "overdue">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [savedViews, setSavedViews] = useState<SavedLeadView[]>([]);
  const [showSaveView, setShowSaveView] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [showAutoDistribute, setShowAutoDistribute] = useState(false);
  const [callModalLead, setCallModalLead] = useState<LeadOut | null>(null);
  const [callModalOutcome, setCallModalOutcome] = useState<LeadStatus | undefined>();
  const [editLead, setEditLead] = useState<LeadOut | null>(null);
  const [categoryLead, setCategoryLead] = useState<LeadOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadOut | null>(null);
  const [lostLead, setLostLead] = useState<LeadOut | null>(null);
  const [menuLead, setMenuLead] = useState<LeadOut | null>(null);
  const [mergeLead, setMergeLead] = useState<LeadOut | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const savedViewsKey = `talkocrm_saved_lead_views:${user?.organization_id ?? "workspace"}`;
  useEffect(() => {
    try {
      const stored = localStorage.getItem(savedViewsKey);
      setSavedViews(stored ? (JSON.parse(stored) as SavedLeadView[]) : []);
    } catch {
      setSavedViews([]);
    }
  }, [savedViewsKey]);

  function persistSavedViews(next: SavedLeadView[]) {
    setSavedViews(next);
    localStorage.setItem(savedViewsKey, JSON.stringify(next));
  }

  function applySavedView(view: SavedLeadView) {
    setSearch(view.filters.q);
    setSourceFilter(view.filters.source as LeadSource | "");
    setStatusFilter(view.filters.status as LeadStatus | "");
    setAssigneeFilter(view.filters.assignee);
    setCategoryFilter(view.filters.category);
    setCityFilter(view.filters.city);
    setCallbackFilter(view.filters.callback as "" | "scheduled" | "overdue");
    setPage(1);
  }

  useEffect(() => {
    const assigneeFromUrl = searchParams.get("assignee") ?? "";
    setAssigneeFilter((current) => (current === assigneeFromUrl ? current : assigneeFromUrl));
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
    setSelectedLeadIds([]);
    setBulkAssigneeId("");
  }, [search, sourceFilter, statusFilter, assigneeFilter, categoryFilter, cityFilter, callbackFilter, pageSize]);

  const filters = {
    q: search || undefined,
    source: sourceFilter || undefined,
    status: statusFilter || undefined,
    assigned_to: isTelecaller || assigneeFilter === "unassigned" ? undefined : assigneeFilter || undefined,
    unassigned_only: !isTelecaller && assigneeFilter === "unassigned" ? true : undefined,
    category: categoryFilter || undefined,
    city: cityFilter || undefined,
    has_callback: callbackFilter ? true : undefined,
    overdue_only: callbackFilter === "overdue" ? true : undefined,
    page,
    page_size: pageSize,
  };

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: usersApi.list, enabled: !isTelecaller });
  const telecallers = useMemo(() => team?.filter((t) => t.role === "telecaller" && t.is_active) ?? [], [team]);
  const workspaceManagers = useMemo(() => team?.filter((t) => t.role === "manager") ?? [], [team]);
  const { data: managers, isLoading: managersLoading } = useQuery({
    queryKey: ["managers"],
    queryFn: usersApi.managers,
    enabled: isTelecaller,
  });

  const { data: categories } = useQuery({ queryKey: ["lead-categories"], queryFn: leadsApi.categories });
  const { data: usedCities } = useQuery({ queryKey: ["lead-cities"], queryFn: leadsApi.usedCities });

  useEffect(() => {
    if (usedCities && cityFilter && !usedCities.includes(cityFilter)) setCityFilter("");
  }, [usedCities, cityFilter]);

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
  const canAdmin = user?.role === "admin";
  const { data: unassignedLeadSummary } = useQuery({
    queryKey: ["leads", "unassigned-summary"],
    queryFn: () => leadsApi.list({ unassigned_only: true, page: 1, page_size: 1 }),
    enabled: canManage,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const visibleUnassignedIds = useMemo(
    () => data?.items.filter((lead) => !lead.assigned_to).map((lead) => lead.id) ?? [],
    [data?.items]
  );
  const allVisibleUnassignedSelected =
    visibleUnassignedIds.length > 0 && visibleUnassignedIds.every((id) => selectedLeadIds.includes(id));
  const callbackLeadsInView = useMemo(
    () => data?.items.filter((lead) => !!lead.next_follow_up_at).length ?? 0,
    [data?.items]
  );
  const overdueLeadsInView = useMemo(
    () =>
      data?.items.filter(
        (lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() < Date.now()
      ).length ?? 0,
    [data?.items]
  );
  const activeFilterCount = [
    search,
    sourceFilter,
    statusFilter,
    assigneeFilter,
    categoryFilter,
    cityFilter,
    callbackFilter,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setSourceFilter("");
    setStatusFilter("");
    setAssigneeFilter("");
    setCategoryFilter("");
    setCityFilter("");
    setCallbackFilter("");
    setSearchParams({});
  }

  function showQueue(queue: "all" | "unassigned" | "scheduled" | "overdue") {
    if (queue === "all") {
      resetFilters();
      return;
    }

    if (queue === "unassigned") {
      setAssigneeFilter("unassigned");
      setCallbackFilter("");
      return;
    }

    setCallbackFilter(queue);
  }

  function toggleLeadSelection(id: string) {
    setSelectedLeadIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  }

  function toggleAllVisibleUnassigned() {
    setSelectedLeadIds((current) => {
      if (allVisibleUnassignedSelected) return current.filter((id) => !visibleUnassignedIds.includes(id));
      return Array.from(new Set([...current, ...visibleUnassignedIds]));
    });
  }

  const bulkAssignMutation = useMutation({
    mutationFn: ({ leadIds, assigneeId }: { leadIds: string[]; assigneeId: string }) =>
      leadsApi.bulkReassign(leadIds, assigneeId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`${result.updated_count} lead${result.updated_count === 1 ? "" : "s"} assigned`, "success");
      setSelectedLeadIds([]);
      setBulkAssigneeId("");
    },
    onError: (error: any) =>
      toast(error?.response?.data?.detail ?? "Couldn't assign the selected leads. Please try again.", "error"),
  });

  const autoAssignMutation = useMutation({
    mutationFn: leadsApi.autoAssignUnassigned,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowAutoDistribute(false);
      setSelectedLeadIds([]);
      setBulkAssigneeId("");
      toast(
        result.assigned_count
          ? `${result.assigned_count} unassigned lead${result.assigned_count === 1 ? "" : "s"} distributed`
          : "There are no unassigned leads to distribute",
        result.assigned_count ? "success" : "info"
      );
    },
    onError: (error: any) =>
      toast(error?.response?.data?.detail ?? "Couldn't distribute unassigned leads. Please try again.", "error"),
  });

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
    <div className="flex flex-col gap-5 lg:gap-6">
      <section className="heritage-panel overflow-hidden rounded-[14px] border border-primary-dark/70 px-5 py-5 shadow-card sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_4px_rgba(201,155,74,0.12)]" />
              Workspace / Pipeline
            </div>
            <h1 className="text-[32px] font-semibold leading-none text-white sm:text-[38px]">
              {isTelecaller ? "My lead desk" : "Lead command center"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-soft/80">
              {isTelecaller
                ? "Keep every customer conversation, callback and next step in one focused queue."
                : "Monitor your lead flow, identify work that needs attention, and keep ownership moving."}
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/85">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#65C59E] align-middle shadow-[0_0_0_4px_rgba(101,197,158,0.12)]" />
            Live lead queue
          </div>
        </div>
        <div className="mt-6 flex w-full flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {isTelecaller && (
            <button
              className="btn-secondary border-white/10 bg-white/[0.08] text-sm text-white hover:border-white/20 hover:bg-white/[0.14] hover:text-white"
              onClick={() => setShowBulk(true)}
            >
              <UploadCloud size={16} /> Upload my leads
            </button>
          )}
          {canManage && (
            <>
              {canAdmin && (
                <>
                  <button className="btn-secondary border-white/10 bg-white/[0.08] text-sm text-white hover:border-white/20 hover:bg-white/[0.14] hover:text-white" onClick={() => setShowCategories(true)}>
                    <Tags size={16} /> Categories
                  </button>
                  <button className="btn-secondary border-white/10 bg-white/[0.08] text-sm text-white hover:border-white/20 hover:bg-white/[0.14] hover:text-white" onClick={handleExport} disabled={exporting}>
                    <Download size={16} /> {exporting ? "Exporting..." : "Export"}
                  </button>
                  <button className="btn-secondary border-white/10 bg-white/[0.08] text-sm text-[#FFB6AF] hover:border-danger/40 hover:bg-danger/15 hover:text-[#FFCBC6]" onClick={() => setShowClearAll(true)}>
                    <Trash2 size={16} /> Clear All
                  </button>
                </>
              )}
              <button className="btn-secondary border-white/10 bg-white/[0.08] text-sm text-white hover:border-white/20 hover:bg-white/[0.14] hover:text-white" onClick={() => setShowBulk(true)}>
                <UploadCloud size={16} /> Bulk Import
              </button>
              <button className="btn-secondary border-white/10 bg-white/[0.08] text-sm text-white hover:border-white/20 hover:bg-white/[0.14] hover:text-white" onClick={() => setShowAutoDistribute(true)}>
                <Shuffle size={16} /> Auto-distribute
              </button>
              <button className="btn-primary ml-auto bg-accent text-sm text-primary-dark hover:bg-[#D5AA5F] focus-visible:ring-accent/30" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add Lead
              </button>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => showQueue("all")}
          className="group rounded-[12px] border border-ink-100 bg-surface p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><Contact size={17} /></div>
            <ArrowUpRight size={16} className="text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Lead base</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{data ? data.total.toLocaleString() : "—"}</p>
          <p className="mt-1 text-xs text-ink-500">All leads in this workspace</p>
        </button>
        <button
          type="button"
          disabled={isTelecaller}
          onClick={() => showQueue("unassigned")}
          className="group rounded-[12px] border border-ink-100 bg-surface p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-card-hover disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-ink-100"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-accent-soft text-accent-dark"><UserRoundX size={17} /></div>
            {!isTelecaller && <ArrowUpRight size={16} className="text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-dark" />}
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Unassigned</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{isTelecaller ? "—" : unassignedLeadSummary?.total ?? "—"}</p>
          <p className="mt-1 text-xs text-ink-500">{isTelecaller ? "Managed by your workspace" : "Workspace total — assign now"}</p>
        </button>
        <button
          type="button"
          onClick={() => showQueue("scheduled")}
          className="group rounded-[12px] border border-ink-100 bg-surface p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/35 hover:shadow-card-hover"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-secondary/10 text-secondary"><CalendarClock size={17} /></div>
            <ArrowUpRight size={16} className="text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-secondary" />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Callbacks queued</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{callbackLeadsInView}</p>
          <p className="mt-1 text-xs text-ink-500">Scheduled in the visible queue</p>
        </button>
        <button
          type="button"
          onClick={() => showQueue("overdue")}
          className="group rounded-[12px] border border-ink-100 bg-surface p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-danger/35 hover:shadow-card-hover"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-danger/10 text-danger"><Clock size={17} /></div>
            <ArrowUpRight size={16} className="text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-danger" />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Past due</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{overdueLeadsInView}</p>
          <p className="mt-1 text-xs text-ink-500">Callbacks requiring attention</p>
        </button>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-[#FBFBF8] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><SlidersHorizontal size={17} /></div>
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Find the right lead</h2>
              <p className="mt-0.5 text-xs text-ink-500">Search, segment and return to your saved views.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && <span className="badge bg-accent-soft text-accent-dark">{activeFilterCount} active</span>}
            {activeFilterCount > 0 && <button className="btn-ghost min-h-8 px-2.5 py-1 text-xs" onClick={resetFilters}>Reset filters</button>}
          </div>
        </div>
        <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 sm:p-4 lg:grid-cols-4 xl:grid-cols-6">
        <div className="relative min-w-[220px] sm:col-span-2 xl:col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            className="input pl-8 py-2"
            aria-label="Search leads"
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
        <select aria-label="Filter by source" className="input py-2" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as LeadSource | "")}>
          <option value="">All Sources</option>
          <option value="manual">Manual</option>
          <option value="indiamart">IndiaMART</option>
          <option value="justdial">JustDial</option>
          <option value="tradeindia">TradeIndia</option>
          <option value="website">Website</option>
          <option value="referral">Referral</option>
        </select>
        <select aria-label="Filter by status" className="input py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}>
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="follow_up">Follow Up</option>
          <option value="not_picked">Not Picked</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        {!isTelecaller && (
          <select
            aria-label="Filter by assignee"
            className="input py-2"
            value={assigneeFilter}
            onChange={(e) => {
              const value = e.target.value;
              setAssigneeFilter(value);
              setSearchParams((params) => {
                if (value) params.set("assignee", value);
                else params.delete("assignee");
                return params;
              });
            }}
          >
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {workspaceManagers.length > 0 && (
              <optgroup label="Managers">
                {workspaceManagers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </optgroup>
            )}
            {telecallers.length > 0 && (
              <optgroup label="Telecallers">
                {telecallers.map((telecaller) => (
                  <option key={telecaller.id} value={telecaller.id}>
                    {telecaller.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
        <select
          className="input py-2"
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as LeadCategory | "")}
        >
          <option value="">All Categories</option>
          {categories?.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        {!!usedCities?.length && (
          <select aria-label="Filter by city" className="input py-2" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">All Cities</option>
            {usedCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          className="input py-2"
          aria-label="Filter by callback schedule"
          value={callbackFilter}
          onChange={(e) => setCallbackFilter(e.target.value as "" | "scheduled" | "overdue")}
        >
          <option value="">All Leads</option>
          <option value="scheduled">Scheduled Callbacks (soonest first)</option>
          <option value="overdue">Overdue Callbacks</option>
        </select>
        <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-2">
          <select
            className="input min-w-0 flex-1 py-2"
            aria-label="Saved lead views"
            value=""
            onChange={(event) => {
              const view = savedViews.find((item) => item.id === event.target.value);
              if (view) applySavedView(view);
            }}
          >
            <option value="">Saved views</option>
            {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
          </select>
          <button className="btn-secondary shrink-0 px-3 py-2 text-sm" aria-label="Save current lead view" onClick={() => setShowSaveView(true)}>
            <Bookmark size={15} /> <span className="hidden sm:inline">Save view</span>
          </button>
        </div>
        </div>
      </section>

      {canManage && selectedLeadIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-accent/25 bg-accent-soft/45 px-4 py-3 shadow-card">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-ink-900">{selectedLeadIds.length} unassigned lead{selectedLeadIds.length === 1 ? "" : "s"} ready to assign</p>
            <p className="text-xs text-ink-500">Choose an active telecaller to move this group in one step.</p>
          </div>
          <select
            aria-label="Assign selected leads to telecaller"
            className="input w-full py-2 sm:w-auto"
            value={bulkAssigneeId}
            onChange={(event) => setBulkAssigneeId(event.target.value)}
          >
            <option value="">Choose telecaller</option>
            {telecallers.map((telecaller) => (
              <option key={telecaller.id} value={telecaller.id}>
                {telecaller.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary text-sm"
            disabled={!bulkAssigneeId || bulkAssignMutation.isPending}
            onClick={() => bulkAssignMutation.mutate({ leadIds: selectedLeadIds, assigneeId: bulkAssigneeId })}
          >
            {bulkAssignMutation.isPending ? "Assigning..." : "Assign selected"}
          </button>
          <button
            className="btn-ghost text-sm"
            disabled={bulkAssignMutation.isPending}
            onClick={() => {
              setSelectedLeadIds([]);
              setBulkAssigneeId("");
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-[#FBFBF8] px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">Operational queue</p>
            <h2 className="mt-1 text-[17px] font-semibold text-ink-900">Lead records</h2>
            <p className="mt-0.5 text-xs text-ink-500">Open a lead to review its history, notes and next action.</p>
          </div>
          <div className="rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-xs font-medium text-ink-600">
            {data ? `${data.items.length} of ${data.total.toLocaleString()} visible` : "Preparing queue"}
          </div>
        </div>
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
          <div className={`transition-opacity duration-200 ${isPlaceholderData ? "opacity-60" : ""}`}>
            <div className="divide-y divide-ink-100 md:hidden">
              {data.items.map((lead) => (
                <article key={lead.id} className={`border-l-2 border-transparent p-4 transition-colors hover:bg-[#FBFBF8] ${selectedLeadIds.includes(lead.id) ? "border-l-primary bg-primary-soft/30" : ""}`}>
                  <div className="flex items-start gap-3">
                    {canManage && (
                      <input
                        type="checkbox"
                        className="mt-2 h-4 w-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Select ${lead.name}`}
                        title={lead.assigned_to ? "Assigned leads cannot be selected for bulk assignment" : undefined}
                        disabled={!!lead.assigned_to}
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                      />
                    )}
                    <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                      {initials(lead.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="font-semibold text-ink-900">{lead.name}</h2>
                        {lead.dnd && <DndBadge />}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">{lead.phone}{lead.city ? ` · ${lead.city}` : ""}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={lead.status} />
                        <CategoryBadge category={lead.category} />
                        <SourceBadge source={lead.source} />
                      </div>
                    </div>
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-ink-100 bg-[#F8F7F3] p-3 text-xs">
                    {!isTelecaller && <div><dt className="text-ink-400">Assigned to</dt><dd className="mt-0.5 font-medium text-ink-700">{lead.assignee_name ?? "Unassigned"}</dd></div>}
                    <div><dt className="text-ink-400">Added</dt><dd className="mt-0.5 font-medium text-ink-700">{formatDate(lead.created_at)}</dd></div>
                    <div><dt className="text-ink-400">Last call</dt><dd className="mt-0.5 font-medium text-ink-700">{lead.last_call ? formatDateTime(lead.last_call.created_at) : "No calls yet"}</dd></div>
                    {lead.next_follow_up_at && <div><dt className="text-ink-400">Next callback</dt><dd className={`mt-0.5 font-medium ${new Date(lead.next_follow_up_at) < new Date() ? "text-danger" : "text-ink-700"}`}>{new Date(lead.next_follow_up_at) < new Date() ? "Overdue" : formatCallbackTime(lead.next_follow_up_at)}</dd></div>}
                  </dl>
                  <div className="mt-3 flex items-center justify-end gap-1">
                    <a aria-label={`Chat with ${lead.name} on WhatsApp`} href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-success hover:bg-success/10">
                      <MessageCircle size={17} />
                    </a>
                    <button aria-label={`Log call for ${lead.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-primary-soft" onClick={() => { setCallModalLead(lead); setCallModalOutcome(undefined); }}>
                      <PhoneCall size={17} />
                    </button>
                    <button aria-label={`More actions for ${lead.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50" onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuLead(menuLead?.id === lead.id ? null : lead); }}>
                      <MoreVertical size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto scroll-shadow-x md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F3F5F4] text-left text-ink-500 text-xs uppercase tracking-wide">
                  {canManage && (
                    <th className="font-medium px-5 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        aria-label="Select all unassigned leads on this page"
                        checked={allVisibleUnassignedSelected}
                        disabled={!visibleUnassignedIds.length}
                        onChange={toggleAllVisibleUnassigned}
                      />
                    </th>
                  )}
                  <th className="font-medium px-5 py-3">S.No.</th>
                  <th className="font-medium px-5 py-3">Lead Added</th>
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
                    className={`border-t border-ink-100 transition-colors duration-150 hover:bg-[#FBFBF8] ${selectedLeadIds.includes(lead.id) ? "bg-primary-soft/30" : ""}`}
                  >
                    {canManage && (
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Select ${lead.name}`}
                          title={lead.assigned_to ? "Assigned leads cannot be selected for bulk assignment" : undefined}
                          disabled={!!lead.assigned_to}
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="px-5 py-3 text-ink-500 tabular-nums">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-5 py-3 text-ink-700 text-xs whitespace-nowrap">{formatDate(lead.created_at)}</td>
                    <td className="px-5 py-3 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
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
                      <div className="flex items-center gap-1.5 flex-wrap" title={(lead.interested_categories ?? [lead.category]).join(", ")}>
                        <CategoryBadge category={lead.category} />
                        {(lead.interested_categories?.length ?? 0) > 1 && (
                          <span className="badge bg-primary/10 text-primary">+{lead.interested_categories.length - 1}</span>
                        )}
                      </div>
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
                    <td className="px-5 py-3 text-ink-500 text-xs whitespace-nowrap">
                      {lead.last_call ? formatDateTime(lead.last_call.created_at) : "No calls yet"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          title="Chat on WhatsApp"
                          aria-label={`Chat with ${lead.name} on WhatsApp`}
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
                          aria-label={`Log call for ${lead.name}`}
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
                          aria-label={`More actions for ${lead.name}`}
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
          </div>
        )}
      </div>

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Page {page} of {totalPages}
            </span>
            <label className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                aria-label="Rows per page"
                className="input w-auto py-1.5 text-xs"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {data.total > pageSize && (
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
          )}
        </div>
      )}

      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} />
      <BulkImportModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        assignToCurrentUser={isTelecaller}
      />
      <CategoryManagerModal open={showCategories} onClose={() => setShowCategories(false)} />
      <CallLogModal
        open={!!callModalLead}
        onClose={() => setCallModalLead(null)}
        lead={callModalLead}
        defaultOutcome={callModalOutcome}
      />
      <EditLeadModal open={!!editLead} onClose={() => setEditLead(null)} lead={editLead} />
      <MergeLeadModal lead={mergeLead} onClose={() => setMergeLead(null)} />
      <SaveLeadViewModal
        open={showSaveView}
        onClose={() => setShowSaveView(false)}
        views={savedViews}
        onSave={(name) => {
          const view: SavedLeadView = {
            id: crypto.randomUUID(),
            name,
            filters: {
              q: search,
              source: sourceFilter,
              status: statusFilter,
              assignee: assigneeFilter,
              category: categoryFilter,
              city: cityFilter,
              callback: callbackFilter,
            },
          };
          persistSavedViews([...savedViews, view]);
          toast(`Saved view “${name}”`, "success");
        }}
        onDelete={(id) => persistSavedViews(savedViews.filter((view) => view.id !== id))}
      />
      <ChangeCategoryModal open={!!categoryLead} onClose={() => setCategoryLead(null)} lead={categoryLead} />
      <MarkLostModal
        open={!!lostLead}
        onClose={() => setLostLead(null)}
        lead={lostLead}
        managers={managers ?? []}
        managersLoading={managersLoading}
      />
      <LeadActionsMenu
        open={!!menuLead}
        anchorEl={menuAnchor}
        lead={menuLead}
        telecallers={telecallers}
        managers={managers ?? []}
        managersLoading={managersLoading}
        canManage={canManage}
        canReassign={canManage || isTelecaller}
        onMarkLost={() => {
          setLostLead(menuLead);
          setMenuLead(null);
        }}
        onChangeCategory={() => {
          setCategoryLead(menuLead);
          setMenuLead(null);
        }}
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
        onMerge={() => {
          setMergeLead(menuLead);
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
      <ConfirmModal
        open={showAutoDistribute}
        onClose={() => setShowAutoDistribute(false)}
        onConfirm={() => autoAssignMutation.mutate()}
        title="Auto-distribute unassigned leads?"
        message="Every unassigned lead will be assigned across active telecallers in round-robin order. Existing assignments will not change, and each new assignment will be recorded in history."
        confirmLabel="Distribute Leads"
        isLoading={autoAssignMutation.isPending}
      />
    </div>
  );
}

function LeadActionsMenu({
  open,
  anchorEl,
  lead,
  telecallers,
  managers,
  managersLoading,
  canManage,
  canReassign,
  onMarkLost,
  onChangeCategory,
  onClose,
  onQuickOutcome,
  onEdit,
  onDelete,
  onMerge,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  lead: LeadOut | null;
  telecallers: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  managersLoading: boolean;
  canManage: boolean;
  canReassign: boolean;
  onMarkLost: () => void;
  onChangeCategory: () => void;
  onClose: () => void;
  onQuickOutcome: (outcome: LeadStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMerge: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reassignMutation = useMutation({
    mutationFn: (assignedTo: string | null) => leadsApi.reassign(lead!.id, assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-history"] });
      toast("Lead reassigned", "success");
      onClose();
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't reassign the lead.", "error"),
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
      <button className={itemClass} onClick={onChangeCategory}>
        <Tags size={15} className="text-primary" /> Change Category
      </button>
      {canReassign && !canManage && (
        <button className={`${itemClass} text-danger`} onClick={onMarkLost}>
          <ArchiveX size={15} className="text-danger" /> Mark as Lost
        </button>
      )}

      {canManage && (
        <>
          <div className="h-px bg-ink-100 my-1" />
          <button className={itemClass} onClick={onEdit}>
            <Pencil size={15} /> Edit Lead
          </button>
          <button className={itemClass} onClick={onMerge}>
            <GitMerge size={15} className="text-primary" /> Merge duplicate
          </button>
          <div className="h-px bg-ink-100 my-1" />
          <p className="px-3 pt-1 pb-1 text-xs font-medium text-ink-500">
            {lead.assigned_to ? "Reassign to" : "Assign to"}
          </p>
          {lead.assigned_to && (
            <button className={itemClass} onClick={() => reassignMutation.mutate(null)}>
              <UserRoundX size={15} className="text-ink-500" /> Unassigned
            </button>
          )}
          {telecallers.map((t) => (
            <button key={t.id} className={itemClass} onClick={() => reassignMutation.mutate(t.id)}>
              {t.name}
            </button>
          ))}
        </>
      )}
      {canReassign && !canManage && (
        <>
          <div className="h-px bg-ink-100 my-1" />
          <p className="px-3 pt-1 pb-1 text-xs font-medium text-ink-500">Send to manager</p>
          {managersLoading ? (
            <p className="px-3 py-2 text-xs text-ink-400">Loading managers...</p>
          ) : managers.length ? (
            managers.map((manager) => (
              <button key={manager.id} className={itemClass} onClick={() => reassignMutation.mutate(manager.id)}>
                {manager.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-ink-400">No active managers available</p>
          )}
        </>
      )}
      {canManage && (
        <>
          <div className="h-px bg-ink-100 my-1" />
          <button className={`${itemClass} text-danger hover:bg-danger/5`} onClick={onDelete}>
            <Trash2 size={15} /> Delete Lead
          </button>
        </>
      )}
    </DropdownMenu>
  );
}
