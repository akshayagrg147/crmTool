import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
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
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";
const EMPTY_FORM = {
  name: "",
  plan: "trial" as Plan,
  admin_name: "",
  admin_phone: "",
  admin_email: "",
  admin_password: "",
};

function validateLogo(file: File): string | null {
  const validType = ["image/png", "image/jpeg", "image/webp"].includes(file.type.toLowerCase());
  const validExtension = /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!validType && !validExtension) return "Choose a PNG, JPG, or WebP image.";
  if (file.size === 0) return "The selected logo is empty.";
  if (file.size > MAX_LOGO_SIZE) return "Logo must be smaller than 5 MB.";
  return null;
}

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const [logoRemoved, setLogoRemoved] = useState(false);

  const detailsQuery = useQuery({
    queryKey: ["organization-details", organization?.id],
    queryFn: () => superAdminApi.getOrganization(organization!.id),
    enabled: !!organization,
  });

  useEffect(() => {
    setLogoFile(null);
    setLogoError("");
    setLogoRemoved(false);
  }, [organization?.id]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

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

  function invalidateOrganization(id: string) {
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
    queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
    queryClient.invalidateQueries({ queryKey: ["organization-details", id] });
  }

  function finish(name: string, message = "updated") {
    if (organization) invalidateOrganization(organization.id);
    toast(`${name} ${message}`, "success");
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoError("");
    setLogoRemoved(false);
    onClose();
  }

  const logoMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => superAdminApi.uploadOrganizationLogo(id, file),
    onSuccess: (updated) => finish(updated.name, "updated with logo"),
    onError: (err: any) => {
      if (organization) invalidateOrganization(organization.id);
      toast(`Organization details saved, but the logo could not be uploaded: ${err?.response?.data?.detail ?? "Logo upload failed."}`, "error");
      setForm(EMPTY_FORM);
      setLogoFile(null);
      setLogoError("");
      setLogoRemoved(false);
      onClose();
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.removeOrganizationLogo(id),
    onSuccess: (updated) => finish(updated.name, "updated; logo removed"),
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't remove the logo.", "error"),
  });

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
      if (logoFile) {
        logoMutation.mutate({ id: updated.id, file: logoFile });
        return;
      }
      if (logoRemoved && detailsQuery.data?.logo_url) {
        removeLogoMutation.mutate(updated.id);
        return;
      }
      finish(updated.name);
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't update organization.", "error"),
  });

  const isBusy = updateMutation.isPending || logoMutation.isPending || removeLogoMutation.isPending;
  const canSubmit =
    !!form.name.trim() &&
    !!form.plan &&
    !!form.admin_name.trim() &&
    form.admin_phone.trim().length >= 6 &&
    (!form.admin_password || form.admin_password.length >= 6);

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setLogoError("");
    if (!file) return;
    const error = validateLogo(file);
    if (error) {
      setLogoError(error);
      setLogoFile(null);
      return;
    }
    setLogoRemoved(false);
    setLogoFile(file);
  }

  function close() {
    if (isBusy) return;
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoError("");
    setLogoRemoved(false);
    onClose();
  }

  const currentLogoUrl = logoPreview ?? (!logoRemoved ? detailsQuery.data?.logo_url : null);

  return (
    <Modal
      open={!!organization}
      onClose={close}
      title="Edit Organization"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close} disabled={isBusy}>Cancel</button>
          <button type="submit" form="edit-organization-form" className="btn-primary" disabled={!canSubmit || isBusy || detailsQuery.isLoading}>
            {isBusy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {logoMutation.isPending ? "Uploading logo…" : removeLogoMutation.isPending ? "Removing logo…" : updateMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </>
      }
    >
      {detailsQuery.isLoading ? (
        <PageLoading />
      ) : detailsQuery.isError ? (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger/[0.06] px-4 py-3 text-sm text-danger">We couldn&apos;t load this organization. Close this window and try again.</div>
      ) : (
        <form
          id="edit-organization-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !isBusy) updateMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="edit-org-name" className="mb-1.5 block text-xs font-medium text-ink-500">Organization name <span className="text-danger">*</span></label>
            <input id="edit-org-name" className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-plan" className="mb-1.5 block text-xs font-medium text-ink-500">Plan <span className="text-danger">*</span></label>
            <select id="edit-org-plan" className="input" required value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value as Plan })}>
              {PLANS.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-ink-500">Organization logo <span className="text-ink-300">(optional)</span></label>
              <span className="text-[10px] text-ink-400">PNG, JPG or WebP · max 5 MB</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-[#FBFAF7] p-3">
              <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-white">
                {currentLogoUrl ? <img src={currentLogoUrl} alt="Organization logo preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus size={21} className="text-ink-300" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">
                  <ImagePlus size={14} aria-hidden="true" />
                  {currentLogoUrl ? "Replace logo" : "Choose logo"}
                  <input type="file" accept={LOGO_ACCEPT} className="sr-only" onChange={handleLogoChange} />
                </label>
                {currentLogoUrl && (
                  <button type="button" className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline" onClick={() => { setLogoFile(null); setLogoRemoved(true); }}>
                    <X size={13} aria-hidden="true" /> Remove
                  </button>
                )}
                <p className="mt-1.5 truncate text-[11px] text-ink-400">{logoFile ? logoFile.name : currentLogoUrl ? "Displayed across the organization’s workspace." : "No custom logo uploaded yet."}</p>
              </div>
            </div>
            {logoError && <p role="alert" className="mt-1.5 text-xs text-danger">{logoError}</p>}
          </div>

          <div className="my-1 h-px bg-ink-100" />
          <div>
            <p className="text-xs font-semibold text-ink-700">Primary administrator</p>
            <p className="mt-1 text-xs text-ink-500">These details are used for the organization&apos;s main contact and login.</p>
          </div>
          <div>
            <label htmlFor="edit-org-admin-name" className="mb-1.5 block text-xs font-medium text-ink-500">Administrator name <span className="text-danger">*</span></label>
            <input id="edit-org-admin-name" className="input" autoComplete="name" required value={form.admin_name} onChange={(event) => setForm({ ...form, admin_name: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-admin-phone" className="mb-1.5 block text-xs font-medium text-ink-500">Contact number <span className="text-danger">*</span></label>
            <input id="edit-org-admin-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" required minLength={6} value={form.admin_phone} onChange={(event) => setForm({ ...form, admin_phone: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-admin-email" className="mb-1.5 block text-xs font-medium text-ink-500">Email</label>
            <input id="edit-org-admin-email" className="input" type="email" autoComplete="email" value={form.admin_email} onChange={(event) => setForm({ ...form, admin_email: event.target.value })} />
          </div>
          <div>
            <label htmlFor="edit-org-admin-password" className="mb-1.5 block text-xs font-medium text-ink-500">New temporary password (optional)</label>
            <input id="edit-org-admin-password" className="input" type="password" autoComplete="new-password" minLength={6} placeholder="Leave blank to keep the current password" value={form.admin_password} onChange={(event) => setForm({ ...form, admin_password: event.target.value })} />
            <p className="mt-1.5 text-xs text-ink-500">Use at least 6 characters. Share it securely with the administrator.</p>
          </div>
        </form>
      )}
    </Modal>
  );
}
