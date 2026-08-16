import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { callsApi, leadsApi } from "@/api/endpoints";
import { StatusBadge, SourceBadge, CategoryBadge, DndBadge } from "@/components/StatusBadge";
import {
  formatCallbackTime,
  formatDateTime,
  formatMinutes,
  timeAgo,
  formatCurrencyFull,
  whatsappLink,
  initials,
} from "@/lib/format";
import type { LeadOut, LeadStatus } from "@/api/types";

/** What the rep should do next, in one sentence — derived from the lead's own
 *  state so the panel never contradicts the call history below it. */
function nextStep(lead: LeadOut): {
  tone: "danger" | "warning" | "success" | "neutral";
  icon: typeof CalendarClock;
  title: string;
  detail: string;
} {
  const callback = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;

  if (callback && callback < new Date()) {
    return {
      tone: "danger",
      icon: AlertTriangle,
      title: "Callback overdue",
      detail: `Was due ${formatCallbackTime(lead.next_follow_up_at!)} — ${timeAgo(lead.next_follow_up_at)}.`,
    };
  }
  if (callback) {
    return {
      tone: "warning",
      icon: CalendarClock,
      title: "Callback scheduled",
      detail: `${formatCallbackTime(lead.next_follow_up_at!)} — ${timeAgo(lead.next_follow_up_at)}.`,
    };
  }

  const byStatus: Record<LeadStatus, { tone: "success" | "neutral"; icon: typeof CalendarClock; title: string; detail: string }> = {
    converted: {
      tone: "success",
      icon: CheckCircle2,
      title: "Converted",
      detail: "This lead has placed an order. No callback is pending.",
    },
    lost: {
      tone: "neutral",
      icon: XCircle,
      title: "Marked as lost",
      detail: "No callback is pending. Reopen by logging a new call.",
    },
    not_picked: {
      tone: "neutral",
      icon: CalendarClock,
      title: "No callback scheduled",
      detail: "The last call wasn't picked up. Log a call to set the next attempt.",
    },
    new: {
      tone: "neutral",
      icon: CalendarClock,
      title: "Not contacted yet",
      detail: "This lead is waiting for its first call.",
    },
    follow_up: {
      tone: "neutral",
      icon: CalendarClock,
      title: "No callback scheduled",
      detail: "Log a call to agree a time and put this back in the follow-up queue.",
    },
  };
  return byStatus[lead.status];
}

const toneStyles = {
  danger: { box: "border-danger/25 bg-danger/5", icon: "text-danger", title: "text-danger" },
  warning: { box: "border-warning/25 bg-warning/5", icon: "text-warning", title: "text-warning" },
  success: { box: "border-success/25 bg-success/5", icon: "text-success", title: "text-success" },
  neutral: { box: "border-ink-100 bg-ink-50", icon: "text-ink-500", title: "text-ink-700" },
} as const;

export function LeadDetailModal({
  open,
  onClose,
  lead,
  onEdit,
  onLogCall,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadOut | null;
  onEdit?: () => void;
  onLogCall?: () => void;
}) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["call-history", lead?.id],
    queryFn: () => callsApi.history(lead!.id),
    enabled: open && !!lead,
  });
  const { data: assignmentHistory, isLoading: assignmentHistoryLoading } = useQuery({
    queryKey: ["assignment-history", lead?.id],
    queryFn: () => leadsApi.assignmentHistory(lead!.id),
    enabled: open && !!lead,
  });

  if (!lead) return null;

  const isOverCredit =
    lead.outstanding_amount != null && lead.credit_limit != null && lead.outstanding_amount > lead.credit_limit;
  const step = nextStep(lead);
  const StepIcon = step.icon;
  const tone = toneStyles[step.tone];

  const location = [lead.city, lead.state].filter(Boolean).join(", ");
  const totalTalkTime = history?.reduce((sum, c) => sum + c.duration_minutes, 0) ?? 0;
  const activeCallbackAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() : null;

  return (
    <Modal open={open} onClose={onClose} title={lead.name} size="lg">
      <div className="flex flex-col gap-5">
        {/* Who this is, and how to reach them */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-badge-indigo/10 text-badge-indigo flex items-center justify-center text-sm font-semibold shrink-0">
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink-900 tabular-nums">{lead.phone}</p>
            <p className="text-xs text-ink-500 mt-0.5">
              {location || "No location on file"} · Assigned to{" "}
              <span className="text-ink-700 font-medium">{lead.assignee_name ?? "nobody yet"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.dnd && <DndBadge />}
            {isOverCredit && (
              <span className="badge bg-warning/10 text-warning" title="Outstanding exceeds credit limit">
                <ShieldAlert size={12} /> Over credit
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={`tel:${lead.phone}`} className="btn-primary text-sm">
            <Phone size={15} /> Call
          </a>
          <a
            href={whatsappLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
          {onLogCall && (
            <button onClick={onLogCall} className="btn-secondary text-sm">
              <PhoneCall size={15} /> Log call
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="btn-ghost text-sm ml-auto">
              <Pencil size={14} /> Edit
            </button>
          )}
        </div>

        {/* The one thing that matters: what happens next */}
        <div className={`rounded-lg border p-3.5 flex items-start gap-2.5 ${tone.box}`}>
          <StepIcon size={16} className={`${tone.icon} shrink-0 mt-0.5`} />
          <div>
            <p className={`text-sm font-semibold ${tone.title}`}>{step.title}</p>
            <p className="text-xs text-ink-500 mt-0.5">{step.detail}</p>
          </div>
        </div>

        {/* Labelled, so it's clear which chip means what */}
        <Section title="Classification">
          <div className="grid grid-cols-2 gap-3">
            <LabelledBadge label="Status">
              <StatusBadge status={lead.status} />
            </LabelledBadge>
            <LabelledBadge label="Came from">
              <SourceBadge source={lead.source} />
            </LabelledBadge>
            <LabelledBadge label="Primary category">
              <CategoryBadge category={lead.category} />
            </LabelledBadge>
            <LabelledBadge label="Categories of interest">
              <div className="flex flex-wrap gap-1.5">
                {(lead.interested_categories?.length ? lead.interested_categories : [lead.category]).map((category) => (
                  <CategoryBadge key={category} category={category} />
                ))}
              </div>
            </LabelledBadge>
          </div>
        </Section>

        <Section title="Lead details">
          <dl className="rounded-lg border border-ink-100 divide-y divide-ink-100 overflow-hidden">
            <Row label="Phone">{lead.phone}</Row>
            <Row label="Location">{location || <Muted>Not recorded</Muted>}</Row>
            {lead.specialty && <Row label="Specialty">{lead.specialty}</Row>}
            {lead.drug_license_number && <Row label="Drug licence">{lead.drug_license_number}</Row>}
            <Row label="Added to CRM">
              {formatDateTime(lead.created_at)} <Muted>({timeAgo(lead.created_at)})</Muted>
            </Row>
            <Row label="Last contacted">
              {lead.last_contacted_at ? (
                <>
                  {formatDateTime(lead.last_contacted_at)} <Muted>({timeAgo(lead.last_contacted_at)})</Muted>
                </>
              ) : (
                <Muted>Never</Muted>
              )}
            </Row>
          </dl>
        </Section>

        {(lead.credit_limit != null || lead.outstanding_amount != null) && (
          <Section title="Credit standing">
            <div
              className={`rounded-lg border p-3.5 ${isOverCredit ? "border-warning/25 bg-warning/5" : "border-ink-100"}`}
            >
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-ink-500">Credit limit</p>
                  <p className="font-semibold text-ink-900 tabular-nums mt-0.5">
                    {lead.credit_limit != null ? formatCurrencyFull(lead.credit_limit) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Outstanding</p>
                  <p
                    className={`font-semibold tabular-nums mt-0.5 ${isOverCredit ? "text-warning" : "text-ink-900"}`}
                  >
                    {lead.outstanding_amount != null ? formatCurrencyFull(lead.outstanding_amount) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Available</p>
                  <p className={`font-semibold tabular-nums mt-0.5 ${isOverCredit ? "text-warning" : "text-ink-900"}`}>
                    {lead.credit_limit != null && lead.outstanding_amount != null
                      ? formatCurrencyFull(lead.credit_limit - lead.outstanding_amount)
                      : "—"}
                  </p>
                </div>
              </div>
              {isOverCredit && (
                <p className="text-xs text-warning mt-2.5 flex items-center gap-1.5">
                  <IndianRupee size={12} /> Outstanding is above the credit limit — clear dues before taking a new
                  order.
                </p>
              )}
            </div>
          </Section>
        )}

        {lead.notes && (
          <Section title="Notes about this lead">
            <p className="rounded-lg border border-ink-100 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-700 whitespace-pre-wrap">
              {lead.notes}
            </p>
          </Section>
        )}

        <Section
          title="Assignment history"
          aside={
            assignmentHistory?.length
              ? `${assignmentHistory.length} ${assignmentHistory.length === 1 ? "change" : "changes"}`
              : undefined
          }
        >
          {assignmentHistoryLoading ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : !assignmentHistory?.length ? (
            <p className="text-sm text-ink-500 rounded-lg border border-dashed border-ink-100 px-3.5 py-4 text-center">
              No assignment history recorded yet.
            </p>
          ) : (
            <ol className="flex flex-col">
              {assignmentHistory.map((event, index) => {
                const isLast = index === assignmentHistory.length - 1;
                const actionLabel =
                  event.action === "lost_handoff"
                    ? "Lost deal routed"
                    : event.action === "created"
                      ? "Lead assigned"
                      : event.action === "unassigned"
                        ? "Lead unassigned"
                        : "Lead reassigned";
                return (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0 pt-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${index === 0 ? "bg-primary ring-4 ring-primary/15" : "bg-ink-300"}`}
                      />
                      {!isLast && <span className="w-px flex-1 bg-ink-100 my-1" />}
                    </div>
                    <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                      <p className="text-sm font-medium text-ink-800">{actionLabel}</p>
                      <p className="text-sm text-ink-700 mt-0.5">
                        {event.previous_assignee_name ?? "Unassigned"} <span className="text-ink-300">→</span>{" "}
                        {event.new_assignee_name ?? "Unassigned"}
                      </p>
                      <p className="text-xs text-ink-500 mt-1">
                        {formatDateTime(event.created_at)} · {timeAgo(event.created_at)} · by{" "}
                        {event.assigned_by_name ?? "System"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section
          title="Call history"
          aside={
            history?.length
              ? `${history.length} ${history.length === 1 ? "call" : "calls"} · ${formatMinutes(totalTalkTime)} talk time`
              : undefined
          }
        >
          {isLoading ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : !history?.length ? (
            <p className="text-sm text-ink-500 rounded-lg border border-dashed border-ink-100 px-3.5 py-4 text-center">
              No calls logged yet.
            </p>
          ) : (
            <ol className="flex flex-col">
              {history.map((call, i) => {
                const isLatest = i === 0;
                const isLast = i === history.length - 1;
                const callbackAt = call.next_follow_up_at ? new Date(call.next_follow_up_at).getTime() : null;
                const callbackStillStands = callbackAt != null && callbackAt === activeCallbackAt;

                return (
                  <li key={call.id} className="flex gap-3">
                    {/* timeline rail */}
                    <div className="flex flex-col items-center shrink-0 pt-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${isLatest ? "bg-primary ring-4 ring-primary/15" : "bg-ink-300"}`}
                      />
                      {!isLast && <span className="w-px flex-1 bg-ink-100 my-1" />}
                    </div>

                    <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={call.outcome} />
                        {/* A duration on an unanswered call is noise */}
                        {call.outcome !== "not_picked" && call.duration_minutes > 0 && (
                          <span className="text-xs text-ink-500">{formatMinutes(call.duration_minutes)} on call</span>
                        )}
                        {call.order_value != null && (
                          <span className="badge bg-success/10 text-success">
                            {formatCurrencyFull(call.order_value)}
                          </span>
                        )}
                        {isLatest && (
                          <span className="badge bg-primary/10 text-primary ml-auto shrink-0">Latest</span>
                        )}
                      </div>

                      {/* Absolute time first — two calls minutes apart both read
                          as "36 minutes ago", which hides their real order */}
                      <p className="text-xs text-ink-500 mt-1">
                        {formatDateTime(call.created_at)} · {timeAgo(call.created_at)} · by{" "}
                        {call.logged_by_name ?? "Unknown"}
                      </p>

                      {call.notes && (
                        <p className="text-sm text-ink-700 mt-1.5 border-l-2 border-ink-100 pl-2.5 whitespace-pre-wrap">
                          {call.notes}
                        </p>
                      )}

                      {call.next_follow_up_at && (
                        <p
                          className={`text-xs mt-1.5 flex items-start gap-1.5 ${
                            callbackStillStands ? "text-warning" : "text-ink-300"
                          }`}
                        >
                          <CalendarClock size={12} className="shrink-0 mt-0.5" />
                          <span>
                            Callback set for {formatCallbackTime(call.next_follow_up_at)}
                            {!callbackStillStands && " — replaced by the call above"}
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{title}</h4>
        {aside && <span className="text-xs text-ink-300">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function LabelledBadge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-ink-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
      <dt className="w-32 shrink-0 text-ink-500">{label}</dt>
      <dd className="text-ink-900 font-medium min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-300 font-normal">{children}</span>;
}
