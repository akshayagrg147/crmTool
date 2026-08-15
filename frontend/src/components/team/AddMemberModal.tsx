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
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        role: form.role,
        password: form.password || undefined,
        state: form.state || null,
        city: form.city || null,
      }),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast(`${member.name} added to the team`, "success");
      setForm({ name: "", phone: "", email: "", role: "telecaller", password: "", state: "", city: "" });
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't add team member.", "error"),
  });

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
            className="btn-primary"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Adding..." : "Add Member"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Email (optional)</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">State (optional)</label>
            <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">City (optional)</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Temporary password (optional)</label>
          <input
            className="input"
            type="text"
            placeholder="Defaults to changeme123"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}
