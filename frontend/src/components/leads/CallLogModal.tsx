import { type ReactNode, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock3, PhoneMissed, Timer, Trophy, XCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { callsApi } from "@/api/endpoints";
import { formatCallbackTime } from "@/lib/format";
import type { LeadOut, LeadStatus } from "@/api/types";

const OUTCOMES: { value: LeadStatus; label: string; description: string; icon: typeof Clock3; tone: string }[] = [
  { value: "follow_up", label: "Follow up", description: "Call again later", icon: CalendarClock, tone: "text-warning" },
  { value: "not_picked", label: "No answer", description: "They did not pick up", icon: PhoneMissed, tone: "text-ink-500" },
  { value: "converted", label: "Converted", description: "Customer placed an order", icon: Trophy, tone: "text-success" },
  { value: "lost", label: "Lost", description: "No opportunity right now", icon: XCircle, tone: "text-danger" },
];

function tomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

const QUICK_CALLBACKS: { label: string; getDate: () => Date }[] = [
  { label: "In 10 minutes", getDate: () => new Date(Date.now() + 10 * 60 * 1000) },
  { label: "In 30 minutes", getDate: () => new Date(Date.now() + 30 * 60 * 1000) },
  { label: "In 1 hour", getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "Tomorrow, 10 AM", getDate: tomorrowMorning },
];

const DURATION_PRESETS = [1, 5, 10, 15];

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CallLogModal({
  open,
  onClose,
  lead,
  defaultOutcome,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadOut | null;
  defaultOutcome?: LeadStatus;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [durationMin, setDurationMin] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [outcome, setOutcome] = useState<LeadStatus>(defaultOutcome ?? "follow_up");
  const [notes, setNotes] = useState("");
  const [orderValue, setOrderValue] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [selectedQuickCallback, setSelectedQuickCallback] = useState("");
  const [showExactTime, setShowExactTime] = useState(false);
  // Errors stay hidden until the first Save attempt — a form that greets you
  // in red before you've typed anything reads as broken.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setDurationMin("");
      setDurationSec("");
      setOutcome(defaultOutcome ?? "follow_up");
      setNotes("");
      setOrderValue("");
      setScheduledAt(null);
      setSelectedQuickCallback("");
      setShowExactTime(false);
      setSubmitted(false);
    }
  }, [open, defaultOutcome, lead]);

  const isConverted = outcome === "converted";
  const isNotPicked = outcome === "not_picked";
  const isFollowUp = outcome === "follow_up";
  const mins = Number(durationMin) || 0;
  const secs = Number(durationSec) || 0;
  const totalMinutes = mins + secs / 60;

  // A field is only required when it's actually on screen — "Not Picked"
  // deliberately hides duration and notes, so it asks for nothing.
  const errors: Record<string, string | undefined> = {
    duration: !isNotPicked
      ? totalMinutes <= 0
        ? "Enter how long the call lasted."
        : secs > 59
          ? "Seconds must be between 0 and 59."
          : undefined
      : undefined,
    callback: isFollowUp && !scheduledAt ? "Pick when to call this lead back." : undefined,
    orderValue: isConverted
      ? !orderValue.trim()
        ? "Enter the order value."
        : Number(orderValue) <= 0
          ? "Order value must be more than ₹0."
          : undefined
      : undefined,
    notes: !isNotPicked && !notes.trim() ? "Write a short summary of the conversation." : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const mutation = useMutation({
    mutationFn: () =>
      callsApi.log(lead!.id, {
        duration_minutes: Math.round(totalMinutes * 100) / 100,
        outcome,
        notes: notes.trim() || undefined,
        order_value: isConverted && orderValue ? Number(orderValue) : null,
        next_follow_up_at: isFollowUp && scheduledAt ? scheduledAt.toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["call-history", lead?.id] });
      toast("Call logged", "success");
      onClose();
    },
    onError: () => toast("Couldn't log the call. Please try again.", "error"),
  });

  function handleSave() {
    setSubmitted(true);
    if (hasErrors) {
      toast("Please complete the highlighted fields before saving.", "error");
      return;
    }
    mutation.mutate();
  }

  if (!lead) return null;

  const show = (key: string) => (submitted ? errors[key] : undefined);
  const fieldClass = (key: string) => `input ${show(key) ? "border-danger" : ""}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log Call — ${lead.name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={mutation.isPending} onClick={handleSave}>
            {mutation.isPending ? "Saving..." : "Save call"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {lead.dnd && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-xs text-danger">
            <XCircle size={15} className="mt-0.5 shrink-0" />
            <span>This contact is marked Do-Not-Disturb. Confirm calling-hours compliance before proceeding.</span>
          </div>
        )}

        <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
          <div className="mb-3 flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Timer size={15} /></span>
            <div><p className="text-sm font-semibold text-ink-800">1. Call duration</p><p className="mt-0.5 text-xs text-ink-500">How long did you speak with the customer?</p></div>
          </div>
          {isNotPicked ? <p className="rounded-lg border border-dashed border-ink-200 bg-white px-3 py-2.5 text-xs text-ink-500">No duration is needed because the call was not answered.</p> : <>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="relative"><span className="sr-only">Minutes</span><input id="call-duration-minutes" aria-label="Call duration in minutes" className={`${fieldClass("duration")} pr-14`} type="number" min="0" step="1" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="0" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">minutes</span></label>
              <label className="relative"><span className="sr-only">Seconds</span><input id="call-duration-seconds" aria-label="Call duration in seconds" className={`${fieldClass("duration")} pr-14`} type="number" min="0" max="59" step="1" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} placeholder="0" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">seconds</span></label>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] text-ink-500">Quick fill:</span>{DURATION_PRESETS.map((preset) => <button key={preset} type="button" className="rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-600 hover:border-primary hover:text-primary" onClick={() => { setDurationMin(String(preset)); setDurationSec("0"); }}>{preset} min</button>)}</div>
            <FieldError>{show("duration")}</FieldError>
          </>}
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-ink-800">2. What happened?</p><p className="mt-0.5 text-xs text-ink-500">Choose the outcome that best matches this conversation.</p></div><span className="text-danger" aria-hidden="true">*</span></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OUTCOMES.map((o) => { const OutcomeIcon = o.icon; return <button key={o.value} type="button" aria-pressed={outcome === o.value} onClick={() => { setOutcome(o.value); if (o.value === "not_picked") { setDurationMin(""); setDurationSec(""); setNotes(""); } if (o.value !== "follow_up") { setScheduledAt(null); setSelectedQuickCallback(""); setShowExactTime(false); } if (o.value !== "converted") setOrderValue(""); }} className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition ${outcome === o.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-ink-100 bg-white hover:border-primary/40 hover:bg-ink-50"}`}><OutcomeIcon size={18} className={outcome === o.value ? "text-primary" : o.tone} /><span className="min-w-0"><span className={`block text-sm font-semibold ${outcome === o.value ? "text-primary" : "text-ink-700"}`}>{o.label}</span><span className="block text-[11px] text-ink-500">{o.description}</span></span></button>; })}
          </div>
        </div>

        {isFollowUp && <div className={`rounded-xl border p-4 ${show("callback") ? "border-danger/30 bg-danger/5" : "border-warning/25 bg-warning/5"}`}>
          <div className="mb-3 flex items-start gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"><CalendarClock size={15} /></span><div><p className="text-sm font-semibold text-ink-800">3. Schedule the next call</p><p className="mt-0.5 text-xs text-ink-500">Pick a time so it appears in the follow-up queue.</p></div><span className="ml-auto text-danger" aria-hidden="true">*</span></div>
          <div className="grid grid-cols-2 gap-2">{QUICK_CALLBACKS.map((quick) => <button key={quick.label} type="button" className={`rounded-lg border bg-white px-2.5 py-2 text-xs font-semibold hover:border-primary hover:text-primary ${selectedQuickCallback === quick.label ? "border-primary text-primary ring-1 ring-primary/20" : "border-ink-200 text-ink-700"}`} onClick={() => { setScheduledAt(quick.getDate()); setSelectedQuickCallback(quick.label); setShowExactTime(false); }}>{quick.label}</button>)}</div>
          <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline" onClick={() => setShowExactTime((value) => !value)}><Clock3 size={13} /> {showExactTime ? "Hide exact date and time" : "Choose an exact date and time"}</button>
          {showExactTime && <input aria-label="Exact callback date and time" className={`input mt-2.5 ${show("callback") ? "border-danger" : ""}`} type="datetime-local" min={toLocalInputValue(new Date())} value={scheduledAt ? toLocalInputValue(scheduledAt) : ""} onChange={(e) => { if (!e.target.value) { setScheduledAt(null); setSelectedQuickCallback(""); return; } const picked = new Date(e.target.value); const now = new Date(); setScheduledAt(picked < now ? now : picked); setSelectedQuickCallback(""); }} />}
          {scheduledAt && <p className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-warning/20 bg-white px-3 py-2 text-xs text-ink-700"><span><strong>Callback:</strong> {formatCallbackTime(scheduledAt.toISOString())}</span><button type="button" className="font-semibold text-danger hover:underline" onClick={() => { setScheduledAt(null); setSelectedQuickCallback(""); }}>Clear</button></p>}
          <FieldError>{show("callback")}</FieldError>
        </div>}

        {isConverted && <div className="rounded-xl border border-success/20 bg-success/5 p-4"><div className="mb-3 flex items-start gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15 text-success"><CheckCircle2 size={15} /></span><div><p className="text-sm font-semibold text-ink-800">Order details</p><p className="mt-0.5 text-xs text-ink-500">Record the value of the order that was won.</p></div></div><FieldLabel>Order value (₹)</FieldLabel><input aria-label="Order value" className={fieldClass("orderValue")} type="number" min="0" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} placeholder="e.g. 12,500" /><FieldError>{show("orderValue")}</FieldError></div>}

        {!isNotPicked && <div><div className="mb-2 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-ink-800">{isFollowUp || isConverted ? "4" : "3"}. Conversation summary</p><p className="mt-0.5 text-xs text-ink-500">Keep the next person up to date.</p></div><span className="text-danger" aria-hidden="true">*</span></div><textarea aria-label="Conversation summary" className={`${fieldClass("notes")} min-h-[92px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Asked for the rate list and will confirm after checking stock." /><p className="mt-1.5 text-xs text-ink-500">This note is saved to the lead timeline.</p><FieldError>{show("notes")}</FieldError></div>}
      </div>
    </Modal>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-xs font-medium text-ink-500 mb-1.5 block">
      {children} <span className="text-danger">*</span>
    </label>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-xs text-danger mt-1.5">{children}</p>;
}
