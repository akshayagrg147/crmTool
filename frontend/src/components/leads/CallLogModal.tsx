import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { callsApi, productsApi } from "@/api/endpoints";
import { formatCallbackTime } from "@/lib/format";
import type { LeadOut, LeadStatus } from "@/api/types";

const OUTCOMES: { value: LeadStatus; label: string }[] = [
  { value: "follow_up", label: "Follow Up" },
  { value: "not_picked", label: "Not Picked" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

function tomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

const QUICK_CALLBACKS: { label: string; getDate: () => Date }[] = [
  { label: "In 10 min", getDate: () => new Date(Date.now() + 10 * 60 * 1000) },
  { label: "In 20 min", getDate: () => new Date(Date.now() + 20 * 60 * 1000) },
  { label: "In 1 hour", getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "Tomorrow, 10 AM", getDate: tomorrowMorning },
];

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
  const [productId, setProductId] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, enabled: open });

  useEffect(() => {
    if (open) {
      setDurationMin("");
      setDurationSec("");
      setOutcome(defaultOutcome ?? "follow_up");
      setNotes("");
      setOrderValue("");
      setProductId(lead?.product_id ?? "");
      setScheduledAt(null);
    }
  }, [open, defaultOutcome, lead]);

  const isConverted = outcome === "converted";
  const isNotPicked = outcome === "not_picked";
  const isFollowUp = outcome === "follow_up";
  const totalMinutes = (Number(durationMin) || 0) + (Number(durationSec) || 0) / 60;

  const mutation = useMutation({
    mutationFn: () =>
      callsApi.log(lead!.id, {
        duration_minutes: Math.round(totalMinutes * 100) / 100,
        outcome,
        notes: notes || undefined,
        order_value: isConverted && orderValue ? Number(orderValue) : null,
        product_id: isConverted && productId ? productId : null,
        next_follow_up_at: isFollowUp && scheduledAt ? scheduledAt.toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["call-history", lead?.id] });
      toast("Call logged", "success");
      onClose();
    },
    onError: () => toast("Couldn't log the call. Please try again.", "error"),
  });

  if (!lead) return null;

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
          <button className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {lead.dnd && (
          <div className="rounded-xl bg-danger/10 text-danger text-xs px-3.5 py-2.5">
            This contact is marked Do-Not-Disturb. Confirm calling-hours compliance before proceeding.
          </div>
        )}
        {!isNotPicked && (
          <div>
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">Duration</label>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <input
                  className="input pr-14"
                  type="number"
                  min="0"
                  step="1"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">min</span>
              </div>
              <div className="relative">
                <input
                  className="input pr-14"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={durationSec}
                  onChange={(e) => setDurationSec(e.target.value)}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">sec</span>
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Outcome</label>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setOutcome(o.value);
                  if (o.value === "not_picked") {
                    setDurationMin("");
                    setDurationSec("");
                    setNotes("");
                  }
                  if (o.value !== "follow_up") {
                    setScheduledAt(null);
                  }
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  outcome === o.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-ink-100 text-ink-500 hover:bg-bg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {isFollowUp && (
          <div className="rounded-xl bg-warning/5 border border-warning/20 p-3.5 flex flex-col gap-2.5">
            <label className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
              <Clock size={13} /> When should we call back?
            </label>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const q = QUICK_CALLBACKS.find((c) => c.label === e.target.value);
                if (q) setScheduledAt(q.getDate());
              }}
            >
              <option value="">
                {scheduledAt ? formatCallbackTime(scheduledAt.toISOString()) : "Choose a quick option..."}
              </option>
              {QUICK_CALLBACKS.map((q) => (
                <option key={q.label} value={q.label}>
                  {q.label}
                </option>
              ))}
            </select>
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Or pick an exact date &amp; time</label>
              <input
                className="input"
                type="datetime-local"
                min={toLocalInputValue(new Date())}
                value={scheduledAt ? toLocalInputValue(scheduledAt) : ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    setScheduledAt(null);
                    return;
                  }
                  const picked = new Date(e.target.value);
                  const now = new Date();
                  setScheduledAt(picked < now ? now : picked);
                }}
              />
            </div>
          </div>
        )}
        {isConverted && (
          <div className="grid grid-cols-2 gap-3.5 rounded-xl bg-success/5 border border-success/20 p-3.5">
            <div className="col-span-2">
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">Product ordered</label>
              <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku && `(${p.sku})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">Order value (₹)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={orderValue}
                onChange={(e) => setOrderValue(e.target.value)}
                placeholder="e.g. 12500"
              />
            </div>
          </div>
        )}
        {!isNotPicked && (
          <div>
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">Notes</label>
            <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </div>
    </Modal>
  );
}
