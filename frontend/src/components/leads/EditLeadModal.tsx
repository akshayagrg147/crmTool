import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { leadsApi } from "@/api/endpoints";
import { INDIAN_STATES } from "@/lib/indianStates";
import type { LeadCategory, LeadOut, LeadSource } from "@/api/types";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "indiamart", label: "IndiaMART" },
  { value: "justdial", label: "JustDial" },
  { value: "tradeindia", label: "TradeIndia" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
];

const CATEGORIES: { value: LeadCategory; label: string; is_custom: boolean }[] = [
  { value: "pharmaceutical", label: "Pharmaceutical", is_custom: false },
  { value: "ayurvedic", label: "Ayurvedic", is_custom: false },
  { value: "homeopathic", label: "Homeopathic", is_custom: false },
  { value: "nutraceutical", label: "Nutraceutical", is_custom: false },
  { value: "generic", label: "Generic", is_custom: false },
  { value: "other", label: "Other", is_custom: false },
];

function toForm(lead: LeadOut) {
  return {
    name: lead.name,
    phone: lead.phone,
    city: lead.city ?? "",
    state: lead.state ?? "",
    source: lead.source,
    notes: lead.notes ?? "",
    category: lead.category,
    interested_categories: lead.interested_categories?.length ? lead.interested_categories : [lead.category],
    drug_license_number: lead.drug_license_number ?? "",
    specialty: lead.specialty ?? "",
    credit_limit: lead.credit_limit != null ? String(lead.credit_limit) : "",
    outstanding_amount: lead.outstanding_amount != null ? String(lead.outstanding_amount) : "",
    dnd: lead.dnd,
  };
}

export function EditLeadModal({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: LeadOut | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(lead ? toForm(lead) : null);
  const { data: categories } = useQuery({
    queryKey: ["lead-categories"],
    queryFn: leadsApi.categories,
    enabled: open,
  });
  const categoryOptions = categories ?? CATEGORIES;

  useEffect(() => {
    if (open && lead) setForm(toForm(lead));
  }, [open, lead]);


  const mutation = useMutation({
    mutationFn: () => {
      if (!lead || !form) throw new Error("no lead");
      return leadsApi.update(lead.id, {
        name: form.name,
        phone: form.phone,
        city: form.city || null,
        state: form.state || null,
        source: form.source,
        notes: form.notes || null,
        category: form.interested_categories[0] ?? form.category,
        interested_categories: form.interested_categories,
        drug_license_number: form.drug_license_number || null,
        specialty: form.specialty || null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        outstanding_amount: form.outstanding_amount ? Number(form.outstanding_amount) : null,
        dnd: form.dnd,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lead-categories"] });
      queryClient.invalidateQueries({ queryKey: ["lead-cities"] });
      toast("Lead updated", "success");
      onClose();
    },
    onError: () => toast("Couldn't update the lead. Please try again.", "error"),
  });

  if (!lead || !form) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Lead — ${lead.name}`}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!form.name || !form.phone || !form.interested_categories.length || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">City</label>
          <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">State</label>
          <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Categories of interest</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-ink-100 p-3">
            {categoryOptions.map((c) => {
              const checked = form.interested_categories.includes(c.value);
              return (
                <label key={c.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-bg cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? form.interested_categories.filter((value) => value !== c.value)
                        : [...form.interested_categories, c.value];
                      setForm({ ...form, interested_categories: next, category: (next[0] ?? form.category) as LeadCategory });
                    }}
                  />
                  <span>{c.label}</span>
                  {c.is_custom && <span className="text-[10px] uppercase tracking-wide text-primary ml-auto">Custom</span>}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-ink-400 mt-1.5">Select every category this customer is interested in.</p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Specialty (optional)</label>
          <input
            className="input"
            placeholder="e.g. Cardiology, Pediatrics"
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Drug license number (optional)</label>
          <input
            className="input"
            value={form.drug_license_number}
            onChange={(e) => setForm({ ...form, drug_license_number: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Credit limit (₹)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Outstanding amount (₹)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={form.outstanding_amount}
            onChange={(e) => setForm({ ...form, outstanding_amount: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Source</label>
          <select
            className="input"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-danger"
              checked={form.dnd}
              onChange={(e) => setForm({ ...form, dnd: e.target.checked })}
            />
            Mark as Do-Not-Disturb
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Note (optional)</label>
          <textarea
            className="input min-h-[70px]"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}
