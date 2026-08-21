import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { usersApi } from "@/api/endpoints";
import { INDIAN_STATES } from "@/lib/indianStates";
import type { UserRole } from "@/api/types";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "telecaller", label: "Telecaller" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "telecaller" as UserRole,
    password: "",
    state: "",
    city: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
        state: form.state,
        city: form.city.trim(),
      }),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast(`${member.name} added to the team`, "success");
      setForm({ name: "", phone: "", email: "", role: "telecaller", password: "", state: "", city: "" });
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't add team member.", "error"),
  });

  const canSubmit =
    !!form.name.trim() &&
    !!form.phone.trim() &&
    !!form.email.trim() &&
    !!form.role &&
    !!form.state &&
    !!form.city.trim() &&
    form.password.length >= 6;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Team Member"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-team-member-form"
            className="btn-primary"
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? "Adding..." : "Add Member"}
          </button>
        </>
      }
    >
      <form
        id="add-team-member-form"
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit && !mutation.isPending) mutation.mutate();
        }}
      >
        <div>
          <label htmlFor="member-name" className="text-xs font-medium text-ink-500 mb-1.5 block">Name <span className="text-danger">*</span></label>
          <input id="member-name" className="input" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="member-phone" className="text-xs font-medium text-ink-500 mb-1.5 block">Phone <span className="text-danger">*</span></label>
          <input id="member-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" required minLength={6} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="member-email" className="text-xs font-medium text-ink-500 mb-1.5 block">Email <span className="text-danger">*</span></label>
          <input
            id="member-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="member-role" className="text-xs font-medium text-ink-500 mb-1.5 block">Role <span className="text-danger">*</span></label>
          <select id="member-role" className="input" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="member-state" className="text-xs font-medium text-ink-500 mb-1.5 block">State <span className="text-danger">*</span></label>
            <select id="member-state" className="input" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="member-city" className="text-xs font-medium text-ink-500 mb-1.5 block">City <span className="text-danger">*</span></label>
            <input id="member-city" className="input" autoComplete="address-level2" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
        </div>
        <div>
          <label htmlFor="member-password" className="text-xs font-medium text-ink-500 mb-1.5 block">Temporary password <span className="text-danger">*</span></label>
          <input
            id="member-password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Minimum 6 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <p className="text-[11px] text-ink-500"><span className="text-danger">*</span> All fields are required.</p>
      </form>
    </Modal>
  );
}
