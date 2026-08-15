import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { superAdminApi } from "@/api/endpoints";

export function CreateOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", admin_name: "", admin_phone: "", admin_email: "", admin_password: "" });

  const mutation = useMutation({
    mutationFn: () => superAdminApi.createOrganization(form),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast(`Organization "${org.name}" created`, "success");
      setForm({ name: "", admin_name: "", admin_phone: "", admin_email: "", admin_password: "" });
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't create organization.", "error"),
  });

  const canSubmit = form.name && form.admin_name && form.admin_phone && form.admin_password.length >= 6;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Organization"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating..." : "Create Organization"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Organization name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="h-px bg-ink-100" />
        <p className="text-xs font-semibold text-ink-700">First Admin</p>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Name</label>
          <input
            className="input"
            value={form.admin_name}
            onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Phone</label>
          <input
            className="input"
            value={form.admin_phone}
            onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Email (optional)</label>
          <input
            className="input"
            type="email"
            value={form.admin_email}
            onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Password</label>
          <input
            className="input"
            type="text"
            value={form.admin_password}
            onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
            placeholder="Minimum 6 characters"
          />
        </div>
      </div>
    </Modal>
  );
}
