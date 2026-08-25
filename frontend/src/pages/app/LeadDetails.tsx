import { type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  History,
  IndianRupee,
  MapPin,
  MessageCircle,
  Paperclip,
  Pencil,
  Phone,
  PhoneCall,
  Send,
  ShieldAlert,
  Tag,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { callsApi, leadsApi, notesApi, workspaceApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { CallLogModal } from "@/components/leads/CallLogModal";
import { EditLeadModal } from "@/components/leads/EditLeadModal";
import { CategoryBadge, DndBadge, SourceBadge, StatusBadge } from "@/components/StatusBadge";
import {
  formatCallbackTime,
  formatCurrencyFull,
  formatDateTime,
  formatMinutes,
  initials,
  timeAgo,
  whatsappLink,
} from "@/lib/format";
import type { LeadActivityOut, LeadOut, PipelineStage } from "@/api/types";

type DetailTab = "overview" | "activity" | "notes";
type ActionTone = "danger" | "warning" | "success" | "neutral" | "primary";
type NextAction = {
  tone: ActionTone;
  icon: typeof AlertTriangle;
  title: string;
  detail: string;
};

const fallbackStages: PipelineStage[] = [
  { id: "new", organization_id: "", key: "new", name: "New", color: "#173A5E", sort_order: 0, is_closed: false, is_won: false, created_at: "" },
  { id: "follow_up", organization_id: "", key: "follow_up", name: "Follow up", color: "#AA7422", sort_order: 1, is_closed: false, is_won: false, created_at: "" },
  { id: "converted", organization_id: "", key: "converted", name: "Converted", color: "#36785E", sort_order: 2, is_closed: true, is_won: true, created_at: "" },
  { id: "lost", organization_id: "", key: "lost", name: "Lost", color: "#B64B45", sort_order: 3, is_closed: true, is_won: false, created_at: "" },
];

function nextAction(lead: LeadOut): NextAction {
  const callbackAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;

  if (callbackAt && callbackAt.getTime() < Date.now()) {
    return {
      tone: "danger",
      icon: AlertTriangle,
      title: "Callback is overdue",
      detail: `This customer was due ${formatCallbackTime(lead.next_follow_up_at!)}. Log the next attempt now.`,
    };
  }
  if (callbackAt) {
    return {
      tone: "warning",
      icon: CalendarClock,
      title: "Callback scheduled",
      detail: `Next conversation: ${formatCallbackTime(lead.next_follow_up_at!)}.`,
    };
  }
  if (lead.status === "converted") {
    return { tone: "success", icon: CheckCircle2, title: "Converted lead", detail: "The order has been recorded. Review the account before the next outreach." };
  }
  if (lead.status === "lost") {
    return { tone: "neutral", icon: Clock3, title: "Lost lead", detail: "There is no callback scheduled for this record." };
  }
  return {
    tone: "primary",
    icon: PhoneCall,
    title: lead.status === "new" ? "First contact needed" : "Plan the next conversation",
    detail: lead.status === "new" ? "This lead has not been contacted yet." : "Log a call to capture the outcome and schedule the next step.",
  };
}

function formatCustomValue(value: unknown) {
  if (value == null || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function readableFieldName(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function LeadDetailsPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [showCallLog, setShowCallLog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ["leads", "detail", leadId],
    queryFn: () => leadsApi.get(leadId!),
    enabled: !!leadId,
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["workspace-stages"],
    queryFn: workspaceApi.stages,
    enabled: !!lead,
  });
  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["lead-activity", leadId],
    queryFn: () => callsApi.activity(leadId!),
    enabled: !!leadId,
  });
  const { data: assignmentHistory = [] } = useQuery({
    queryKey: ["assignment-history", leadId],
    queryFn: () => leadsApi.assignmentHistory(leadId!),
    enabled: !!leadId,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: () => notesApi.list(leadId!),
    enabled: !!leadId,
  });
  const { data: attachments = [] } = useQuery({
    queryKey: ["lead-attachments", leadId],
    queryFn: () => notesApi.attachments(leadId!),
    enabled: !!leadId,
  });

  const refreshRecord = () => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
    void queryClient.invalidateQueries({ queryKey: ["assignment-history", leadId] });
  };
  const noteMutation = useMutation({
    mutationFn: () => notesApi.create(leadId!, { body: noteBody.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      void queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      setNoteBody("");
      toast("Team note added", "success");
    },
    onError: () => toast("Couldn't add the note. Please try again.", "error"),
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => notesApi.upload(leadId!, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-attachments", leadId] });
      void queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      toast("File attached", "success");
    },
    onError: () => toast("Couldn't attach the file. Please try again.", "error"),
  });
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => notesApi.remove(leadId!, noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      void queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      toast("Team note removed", "success");
    },
    onError: () => toast("Couldn't remove the note. Please try again.", "error"),
  });
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => notesApi.removeAttachment(leadId!, attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-attachments", leadId] });
      void queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      toast("Attachment removed", "success");
    },
    onError: () => toast("Couldn't remove the attachment. Please try again.", "error"),
  });
  const downloadMutation = useMutation({
    mutationFn: (attachmentId: string) => notesApi.download(leadId!, attachmentId),
    onSuccess: (blob, attachmentId) => {
      const attachment = attachments.find((item) => item.id === attachmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment?.filename ?? "attachment";
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast("Couldn't download the attachment. Please try again.", "error"),
  });

  const stageJourney = useMemo(() => (stages.length ? [...stages].sort((a, b) => a.sort_order - b.sort_order) : fallbackStages), [stages]);
  const callActivity = useMemo(() => activity.filter((event) => event.event_type === "call"), [activity]);
  const totalTalkTime = useMemo(
    () => callActivity.reduce((total, event) => total + (event.duration_minutes ?? 0), 0),
    [callActivity]
  );
  const canManage = user?.role === "admin" || user?.role === "manager";

  if (isLoading) {
    return <LeadRecordLoading onBack={() => navigate("/leads")} />;
  }

  if (isError || !lead) {
    return (
      <div className="card mx-auto max-w-2xl p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger"><AlertTriangle size={22} /></div>
        <h1 className="mt-4 text-2xl font-semibold text-ink-900">Lead record unavailable</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">This lead may have been removed or you may no longer have permission to view it.</p>
        <button className="btn-primary mt-5" onClick={() => navigate("/leads")}><ArrowLeft size={16} /> Back to leads</button>
      </div>
    );
  }

  const location = [lead.city, lead.state].filter(Boolean).join(", ");
  const action = nextAction(lead);
  const ActionIcon = action.icon;
  const stageIndex = Math.max(0, stageJourney.findIndex((stage) => stage.key === lead.stage_key || stage.key === lead.status));
  const isOverCredit = lead.credit_limit != null && lead.outstanding_amount != null && lead.outstanding_amount > lead.credit_limit;
  const interestedCategories = lead.interested_categories?.length ? lead.interested_categories : [lead.category];
  const customFields = Object.entries(lead.custom_fields ?? {}).filter(([, value]) => value != null && value !== "");
  const actionStyles = {
    danger: "border-danger/25 bg-danger/5 text-danger",
    warning: "border-warning/25 bg-warning/5 text-warning",
    success: "border-success/25 bg-success/5 text-success",
    neutral: "border-ink-100 bg-ink-50 text-ink-700",
    primary: "border-primary/20 bg-primary-soft text-primary",
  } as const;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-8 lg:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost -ml-2 px-2 text-sm" onClick={() => navigate("/leads")}>
          <ArrowLeft size={16} /> Back to leads
        </button>
        <p className="text-xs text-ink-500">Record created {formatDateTime(lead.created_at)}</p>
      </div>

      <section className="overflow-hidden rounded-[14px] border border-ink-100 bg-surface shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-sm font-bold text-primary sm:h-14 sm:w-14">
              {initials(lead.name)}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-dark">Lead record</p>
                {lead.dnd && <DndBadge />}
              </div>
              <h1 className="truncate text-[27px] font-semibold leading-tight text-ink-900 sm:text-[34px]">{lead.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-primary" /> {lead.phone}</span>
                {location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-primary" /> {location}</span>}
                <span className="inline-flex items-center gap-1.5"><UserRound size={14} className="text-primary" /> {lead.assignee_name ?? "Unassigned"}</span>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <a href={`tel:${lead.phone}`} className="btn-secondary text-sm"><Phone size={15} /> Call</a>
            <a href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm"><MessageCircle size={15} /> WhatsApp</a>
            <button className="btn-primary text-sm" onClick={() => setShowCallLog(true)}><PhoneCall size={15} /> Log call</button>
            {canManage && <button className="btn-secondary text-sm" onClick={() => setShowEdit(true)}><Pencil size={15} /> Edit</button>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 bg-[#FBFBF8] px-5 py-3 sm:px-6">
          <StatusBadge status={lead.status} />
          <SourceBadge source={lead.source} />
          {interestedCategories.map((category) => <CategoryBadge key={category} category={category} />)}
          {isOverCredit && <span className="badge bg-warning/10 text-warning"><ShieldAlert size={12} /> Over credit</span>}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">Pipeline position</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">Current stage: {stageJourney[stageIndex]?.name ?? lead.status}</p>
          </div>
          <button className="btn-ghost min-h-8 px-2.5 py-1 text-xs" onClick={() => setShowEdit(true)} disabled={!canManage}>Edit stage</button>
        </div>
        <ol className="flex min-w-max overflow-x-auto px-3 py-4 sm:px-5" aria-label="Lead pipeline progress">
          {stageJourney.map((stage, index) => {
            const current = index === stageIndex;
            const complete = index < stageIndex || (current && stage.is_closed);
            return (
              <li key={stage.id} className="flex min-w-[132px] flex-1 items-center last:min-w-[108px]">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${current ? "border-primary bg-primary text-white shadow-[0_0_0_4px_rgba(23,58,94,0.10)]" : complete ? "border-success bg-success text-white" : "border-ink-100 bg-white text-ink-400"}`}>
                    {complete ? <CheckCircle2 size={13} /> : index + 1}
                  </span>
                  <span className={`truncate text-xs font-semibold ${current ? "text-primary" : complete ? "text-success" : "text-ink-500"}`}>{stage.name}</span>
                </div>
                {index < stageJourney.length - 1 && <span className={`mx-3 h-px min-w-5 flex-1 ${complete ? "bg-success/45" : "bg-ink-100"}`} />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-ink-100" role="tablist" aria-label="Lead record sections">
        <RecordTab active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={FileText}>Overview</RecordTab>
        <RecordTab active={activeTab === "activity"} onClick={() => setActiveTab("activity")} icon={History}>Activity timeline</RecordTab>
        <RecordTab active={activeTab === "notes"} onClick={() => setActiveTab("notes")} icon={Paperclip}>Notes & files</RecordTab>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="card p-5 sm:p-6">
              <SectionHeading eyebrow="Relationship" title="Contact & ownership" icon={UserRound} />
              <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <InfoField label="Lead owner">{lead.assignee_name ?? "Unassigned — choose an owner from the Leads page"}</InfoField>
                <InfoField label="Primary phone"><a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`tel:${lead.phone}`}><Phone size={14} /> {lead.phone}</a></InfoField>
                <InfoField label="Location">{location || "Not recorded"}</InfoField>
                <InfoField label="Lead source"><SourceBadge source={lead.source} /></InfoField>
                <InfoField label="Last contacted">{lead.last_contacted_at ? `${formatDateTime(lead.last_contacted_at)} · ${timeAgo(lead.last_contacted_at)}` : "No calls yet"}</InfoField>
                <InfoField label="Created">{formatDateTime(lead.created_at)}</InfoField>
              </dl>
            </section>

            <section className="card p-5 sm:p-6">
              <SectionHeading eyebrow="Qualification" title="Lead profile" icon={Tag} />
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="section-label">Categories of interest</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">{interestedCategories.map((category) => <CategoryBadge key={category} category={category} />)}</div>
                </div>
                <div>
                  <p className="section-label">Qualification score</p>
                  <div className="mt-2.5 flex items-center gap-3"><span className={`badge ${lead.score_band === "hot" ? "bg-danger/10 text-danger" : lead.score_band === "warm" ? "bg-warning/10 text-warning" : "bg-primary-soft text-primary"}`}>{lead.score}/100 · {lead.score_band}</span><span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-ink-100"><span className={`block h-full rounded-full ${lead.score_band === "hot" ? "bg-danger" : lead.score_band === "warm" ? "bg-warning" : "bg-primary"}`} style={{ width: `${lead.score}%` }} /></span></div>
                </div>
                {lead.specialty && <InfoField label="Specialty">{lead.specialty}</InfoField>}
                {lead.drug_license_number && <InfoField label="Drug licence number">{lead.drug_license_number}</InfoField>}
                {lead.notes && <div className="lg:col-span-2"><p className="section-label">Original lead note</p><p className="mt-2 rounded-[9px] border border-ink-100 bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">{lead.notes}</p></div>}
              </div>
              {customFields.length > 0 && <div className="mt-6 border-t border-ink-100 pt-5"><p className="section-label">Custom information</p><dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">{customFields.map(([key, value]) => <InfoField key={key} label={readableFieldName(key)}>{formatCustomValue(value)}</InfoField>)}</dl></div>}
            </section>

            {(lead.credit_limit != null || lead.outstanding_amount != null) && (
              <section className={`card p-5 sm:p-6 ${isOverCredit ? "border-warning/30" : ""}`}>
                <SectionHeading eyebrow="Commercial" title="Credit standing" icon={IndianRupee} />
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <Metric label="Credit limit" value={lead.credit_limit != null ? formatCurrencyFull(lead.credit_limit) : "—"} />
                  <Metric label="Outstanding" value={lead.outstanding_amount != null ? formatCurrencyFull(lead.outstanding_amount) : "—"} tone={isOverCredit ? "warning" : undefined} />
                  <Metric label="Available credit" value={lead.credit_limit != null && lead.outstanding_amount != null ? formatCurrencyFull(lead.credit_limit - lead.outstanding_amount) : "—"} tone={isOverCredit ? "warning" : undefined} />
                </div>
                {isOverCredit && <p className="mt-4 flex items-center gap-2 text-xs text-warning"><AlertTriangle size={13} /> Outstanding amount is above the approved credit limit.</p>}
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <section className={`rounded-[12px] border p-5 shadow-card ${actionStyles[action.tone]}`}>
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white/70"><ActionIcon size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Next best action</p><h2 className="mt-1 text-lg font-semibold">{action.title}</h2><p className="mt-2 text-sm leading-relaxed text-ink-600">{action.detail}</p></div></div>
              <button className="btn-primary mt-5 w-full text-sm" onClick={() => setShowCallLog(true)}><PhoneCall size={15} /> Log call outcome</button>
            </section>

            <section className="card p-5">
              <SectionHeading eyebrow="At a glance" title="Conversation health" icon={Activity} />
              <dl className="mt-4 divide-y divide-ink-100">
                <CompactRow label="Call attempts" value={String(callActivity.length)} />
                <CompactRow label="Total talk time" value={callActivity.length ? formatMinutes(totalTalkTime) : "No talk time yet"} />
                <CompactRow label="Next callback" value={lead.next_follow_up_at ? formatCallbackTime(lead.next_follow_up_at) : "Not scheduled"} emphasis={!!lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() < Date.now()} />
                <CompactRow label="Team notes" value={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`} />
              </dl>
            </section>

            <section className="card p-5">
              <SectionHeading eyebrow="Latest handoff" title="Ownership history" icon={History} />
              <div className="mt-4 space-y-3">
                {assignmentHistory.length ? assignmentHistory.slice(0, 3).map((entry) => <div key={entry.id} className="border-l-2 border-primary/20 pl-3"><p className="text-sm font-medium text-ink-800">{entry.new_assignee_name ?? "Unassigned"}</p><p className="mt-0.5 text-xs leading-relaxed text-ink-500">{entry.action} by {entry.assigned_by_name ?? "System"} · {timeAgo(entry.created_at)}</p></div>) : <p className="rounded-lg border border-dashed border-ink-100 px-3 py-3 text-xs leading-relaxed text-ink-500">No reassignment history yet. The current owner is shown above.</p>}
              </div>
            </section>
          </aside>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="card p-5 sm:p-6">
            <SectionHeading eyebrow="Complete record" title="Activity timeline" icon={History} aside={activity.length ? `${activity.length} events · ${formatMinutes(totalTalkTime)} talk time` : undefined} />
            <ActivityTimeline activity={activity} isLoading={activityLoading} activeCallbackAt={lead.next_follow_up_at} />
          </section>
          <section className="card p-5 sm:p-6">
            <SectionHeading eyebrow="Accountability" title="Assignment history" icon={UserRound} />
            <div className="mt-5 space-y-4">{assignmentHistory.length ? assignmentHistory.map((entry) => <div key={entry.id} className="rounded-[9px] border border-ink-100 bg-[#FBFBF8] px-3.5 py-3"><p className="text-sm font-semibold text-ink-800">{entry.previous_assignee_name ?? "Unassigned"} → {entry.new_assignee_name ?? "Unassigned"}</p><p className="mt-1 text-xs text-ink-500">{entry.action} by {entry.assigned_by_name ?? "System"}</p><p className="mt-1 text-xs text-ink-400">{formatDateTime(entry.created_at)}</p></div>) : <p className="text-sm text-ink-500">No assignment changes have been recorded.</p>}</div>
          </section>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="card p-5 sm:p-6">
            <SectionHeading eyebrow="Shared context" title="Team notes" icon={FileText} aside={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`} />
            <div className="mt-5 space-y-3">
              {notes.length ? notes.map((note) => <article key={note.id} className={`rounded-[10px] border px-4 py-3.5 ${note.pinned ? "border-accent/35 bg-accent/5" : "border-ink-100 bg-[#FBFBF8]"}`}><div className="flex items-start gap-3"><p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{note.body}</p><button className="btn-ghost min-h-8 shrink-0 px-2 text-danger hover:bg-danger/5 hover:text-danger" aria-label={`Delete note by ${note.author_name ?? "System"}`} onClick={() => deleteNoteMutation.mutate(note.id)} disabled={deleteNoteMutation.isPending}><Trash2 size={14} /></button></div><p className="mt-2 text-xs text-ink-500">{note.author_name ?? "System"} · {formatDateTime(note.created_at)}{note.pinned ? " · Pinned" : ""}</p></article>) : <p className="rounded-[10px] border border-dashed border-ink-100 px-4 py-6 text-center text-sm text-ink-500">No team notes yet. Add context that will help the next owner.</p>}
              <div className="rounded-[10px] border border-primary/15 bg-primary-soft/35 p-3"><label className="section-label" htmlFor="team-note">Add a team note</label><div className="mt-2 flex items-end gap-2"><textarea id="team-note" className="input min-h-24 flex-1 resize-y bg-white" placeholder="What should the team know before the next conversation?" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} /><button className="btn-primary h-10 shrink-0 px-3" aria-label="Save team note" disabled={!noteBody.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}><Send size={15} /></button></div></div>
            </div>
          </section>
          <section className="card p-5 sm:p-6">
            <SectionHeading eyebrow="Supporting evidence" title="Files & attachments" icon={Paperclip} aside={`${attachments.length} files`} />
            <div className="mt-5 space-y-2.5">{attachments.length ? attachments.map((attachment) => <div key={attachment.id} className="flex items-center gap-2 rounded-[9px] border border-ink-100 px-3 py-2.5"><FileText size={15} className="shrink-0 text-primary" /><button className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink-800 hover:text-primary hover:underline" onClick={() => downloadMutation.mutate(attachment.id)}>{attachment.filename}</button><span className="text-xs text-ink-400">{Math.max(1, Math.round(attachment.size_bytes / 1024))} KB</span><button className="btn-ghost min-h-8 shrink-0 px-2 text-ink-500" aria-label={`Download ${attachment.filename}`} onClick={() => downloadMutation.mutate(attachment.id)}><Download size={14} /></button><button className="btn-ghost min-h-8 shrink-0 px-2 text-danger hover:bg-danger/5 hover:text-danger" aria-label={`Delete ${attachment.filename}`} onClick={() => deleteAttachmentMutation.mutate(attachment.id)} disabled={deleteAttachmentMutation.isPending}><Trash2 size={14} /></button></div>) : <p className="rounded-[10px] border border-dashed border-ink-100 px-4 py-5 text-center text-sm text-ink-500">No supporting files attached yet.</p>}
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-dashed border-primary/30 bg-primary-soft/30 px-3 py-3 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary-soft"><UploadCloud size={16} /> {uploadMutation.isPending ? "Uploading file…" : "Attach a file"}<input className="sr-only" type="file" disabled={uploadMutation.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); event.target.value = ""; }} /></label>
            </div>
          </section>
        </div>
      )}

      <CallLogModal open={showCallLog} onClose={() => { setShowCallLog(false); refreshRecord(); }} lead={lead} />
      <EditLeadModal open={showEdit} onClose={() => { setShowEdit(false); refreshRecord(); }} lead={lead} />
    </div>
  );
}

function RecordTab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof FileText; children: ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-sm font-semibold transition-colors ${active ? "border-primary text-primary" : "border-transparent text-ink-500 hover:text-ink-800"}`}><Icon size={15} /> {children}</button>;
}

function SectionHeading({ eyebrow, title, icon: Icon, aside }: { eyebrow: string; title: string; icon: typeof FileText; aside?: string }) {
  return <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><Icon size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">{eyebrow}</p><h2 className="mt-0.5 text-[17px] font-semibold text-ink-900">{title}</h2></div></div>{aside && <span className="pt-1 text-xs text-ink-500">{aside}</span>}</div>;
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</dt><dd className="mt-1.5 text-sm font-medium leading-relaxed text-ink-800">{children}</dd></div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return <div className="rounded-[9px] border border-ink-100 bg-[#FBFBF8] px-3.5 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-500">{label}</p><p className={`mt-1.5 text-lg font-semibold tabular-nums ${tone === "warning" ? "text-warning" : "text-ink-900"}`}>{value}</p></div>;
}

function CompactRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-ink-500">{label}</dt><dd className={`max-w-[58%] text-right text-xs font-semibold leading-relaxed ${emphasis ? "text-danger" : "text-ink-800"}`}>{value}</dd></div>;
}

function ActivityTimeline({ activity, isLoading, activeCallbackAt }: { activity: LeadActivityOut[]; isLoading: boolean; activeCallbackAt: string | null }) {
  if (isLoading) return <p className="mt-5 text-sm text-ink-500">Loading activity…</p>;
  if (!activity.length) return <p className="mt-5 rounded-[10px] border border-dashed border-ink-100 px-4 py-7 text-center text-sm text-ink-500">No activity has been recorded for this lead yet.</p>;
  const activeCallbackTime = activeCallbackAt ? new Date(activeCallbackAt).getTime() : null;
  return <ol className="mt-6">{activity.map((event, index) => { const isLast = index === activity.length - 1; const EventIcon = event.event_type === "call" ? PhoneCall : event.event_type === "assignment" ? UserRound : Activity; const eventCallbackTime = event.next_follow_up_at ? new Date(event.next_follow_up_at).getTime() : null; const currentCallback = eventCallbackTime != null && eventCallbackTime === activeCallbackTime; return <li key={`${event.event_type}-${event.id}`} className="flex gap-3"><div className="flex flex-col items-center"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-primary text-white shadow-[0_0_0_4px_rgba(23,58,94,0.10)]" : "bg-primary-soft text-primary"}`}><EventIcon size={14} /></span>{!isLast && <span className="my-1.5 w-px flex-1 bg-ink-100" />}</div><div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-6"}`}><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-ink-800">{event.title}</p>{event.call_outcome && <StatusBadge status={event.call_outcome} />}{event.order_value != null && <span className="badge bg-success/10 text-success">{formatCurrencyFull(event.order_value)}</span>}</div><p className="mt-1 text-xs text-ink-500">{formatDateTime(event.occurred_at)} · {timeAgo(event.occurred_at)} · {event.actor_name ?? "System"}</p>{event.body && <p className="mt-2 border-l-2 border-ink-100 pl-3 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">{event.body}</p>}{event.next_follow_up_at && <p className={`mt-2 flex items-start gap-1.5 text-xs ${currentCallback ? "text-warning" : "text-ink-400"}`}><CalendarClock size={12} className="mt-0.5 shrink-0" /> Callback set for {formatCallbackTime(event.next_follow_up_at)}{!currentCallback && " · replaced later"}</p>}</div></li>; })}</ol>;
}

function LeadRecordLoading({ onBack }: { onBack: () => void }) {
  return <div className="space-y-5"><button className="btn-ghost -ml-2 px-2 text-sm" onClick={onBack}><ArrowLeft size={16} /> Back to leads</button><div className="card p-6"><div className="skeleton h-4 w-28" /><div className="skeleton mt-4 h-9 w-72" /><div className="skeleton mt-4 h-4 w-52" /></div><div className="card p-5"><div className="skeleton h-4 w-36" /><div className="mt-5 grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-24" />)}</div></div></div>;
}
