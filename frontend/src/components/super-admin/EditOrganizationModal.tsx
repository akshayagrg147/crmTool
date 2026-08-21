import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { superAdminApi } from "@/api/endpoints";
import { Modal } from "@/components/Modal";
import { PageLoading } from "@/components/Spinner";
import { useToast } from "@/hooks/useToast";
import type { OrganizationOut } from "@/api/types";

type Plan = "trial" | "starter" | "professional" | "enterprise";

const PLANS: { value: Plan; label: string }[] = [
  { value: "trial", label: "Trial" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

const EMPTY_FORM = {
  name: "",
  plan: "trial" as Plan,
  admin_name: "",
  admin_phone: "",
  admin_email: "",
  admin_password: "",
};

export function EditOrganizationModal({
  organization,
  onClose,
}: {
  organization: OrganizationOut | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const detailsQuery = useQuery({
    queryKey: ["organization-details", organization?.id],
    queryFn: () => superAdminApi.getOrganization(organization!.id),
    enabled: !!organization,
  });

  useEffect(() => {
    if (!detailsQuery.data) return;
    const primaryAdmin = detailsQuery.data.members.find((member) => member.role === "admin");
    const selectedPlan = PLANS.some((plan) => plan.value === detailsQuery.data.plan)
      ? (detailsQuery.data.plan as Plan)
      : "trial";
    setForm({
      name: detailsQuery.data.name,
      plan: selectedPlan,
      admin_name: primaryAdmin?.name ?? "",
      admin_phone: primaryAdmin?.phone ?? "",
      admin_email: primaryAdmin?.email ?? "",
      admin_password: "",
    });
  }, [detailsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      superAdminApi.updateOrganization(organization!.id, {
        name: form.name.trim(),
        plan: form.plan,
        admin_name: form.admin_name.trim(),
        admin_phone: form.admin_phone.trim(),
        admin_email: form.admin_email.trim() || null,
        admin_password: form.admin_password || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["organization-details", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast(`${updated.name} updated`, "success");
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't update organization.", "error"),
  });

  const canSubmit =
    !!form.name.trim() &&
    !!form.plan &&
    !!form.admin_name.trim() &&
    form.admin_phone.trim().length >= 6 &&
    (!form.admin_password || form.admin_password.length >= 6);

  function close() {
    if (updateMutation.isPending) return;
    setForm(EMPTY_FORM);
    onClose();
  }

  return (
    <Modal
      open={!!organization}
      onClose={close}
      title="Edit Organization"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close} disabled={updateMutation.isPending}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-organization-form"
            className="btn-primary"
            disabled={!canSubmit || updateMutation.isPending || detailsQuery.isLoading}
          >
            {updateMutation.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </>
      }
    >
      {detailsQuery.isLoading ? (
        <PageLoading />
      ) : detailsQuery.isError ? (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger/[0.06] px-4 py-3 text-sm text-danger">
          We couldn&apos;t load this organization. Close this window and try again.
        </div>
      ) : (
        <form
          id="edit-organization-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !updateMutation.isPending) updateMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="edit-org-name" className="mb-1.5 block text-xs font-medium text-ink-500">
              Organization name <span className="text-danger">*</span>
            </label>
            <input id="edit-org-name" className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-plan" className="mb-1.5 block text-xs font-medium text-ink-500">
              Plan <span className="text-danger">*</span>
            </label>
            <select id="edit-org-plan" className="input" required value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value as Plan })}>
              {PLANS.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
            </select>
          </div>

          <div className="my-1 h-px bg-ink-100" />
          <div>
            <p className="text-xs font-semibold text-ink-700">Primary administrator</p>
            <p className="mt-1 text-xs text-ink-500">These details are used for the organization&apos;s main contact and login.</p>
          </div>
          <div>
            <label htmlFor="edit-org-admin-name" className="mb-1.5 block text-xs font-medium text-ink-500">
              Administrator name <span className="text-danger">*</span>
            </label>
            <input id="edit-org-admin-name" className="input" autoComplete="name" required value={form.admin_name} onChange={(event) => setForm({ ...form, admin_name: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-admin-phone" className="mb-1.5 block text-xs font-medium text-ink-500">
              Contact number <span className="text-danger">*</span>
            </label>
            <input id="edit-org-admin-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" required minLength={6} value={form.admin_phone} onChange={(event) => setForm({ ...form, admin_phone: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-admin-email" className="mb-1.5 block text-xs font-medium text-ink-500">Email</label>
            <input id="edit-org-admin-email" className="input" type="email" autoComplete="email" value={form.admin_email} onChange={(event) => setForm({ ...form, admin_email: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-admin-password" className="mb-1.5 block text-xs font-medium text-ink-500">New temporary password (optional)</label>
            <input
              id="edit-org-admin-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              placeholder="Leave blank to keep the current password"
              value={form.admin_password}
              onChange={(event) => setForm({ ...form, admin_password: event.target.value })}
            />
            <p className="mt-1.5 text-xs text-ink-500">Use at least 6 characters. Share it securely with the administrator.</p>
          </div>
        </form>
      )}
    </Modal>
  );
}
