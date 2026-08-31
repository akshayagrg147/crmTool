import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { superAdminApi } from "@/api/endpoints";

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

function validateLogo(file: File): string | null {
  const validType = ["image/png", "image/jpeg", "image/webp"].includes(file.type.toLowerCase());
  const validExtension = /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!validType && !validExtension) return "Choose a PNG, JPG, or WebP image.";
  if (file.size === 0) return "The selected logo is empty.";
  if (file.size > MAX_LOGO_SIZE) return "Logo must be smaller than 5 MB.";
  return null;
}

export function CreateOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", admin_name: "", admin_phone: "", admin_email: "", admin_password: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

  function reset() {
    setForm({ name: "", admin_name: "", admin_phone: "", admin_email: "", admin_password: "" });
    setLogoFile(null);
    setLogoError("");
  }

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
    setLogoFile(file);
  }

  const logoMutation = useMutation({
    mutationFn: ({ orgId, file }: { orgId: string; file: File }) => superAdminApi.uploadOrganizationLogo(orgId, file),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast(`Organization "${org.name}" created with logo`, "success");
      reset();
      onClose();
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      const detail = err?.response?.data?.detail ?? "Logo upload failed.";
      toast(`Organization created, but the logo could not be uploaded: ${detail}`, "error");
      reset();
      onClose();
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      superAdminApi.createOrganization({
        name: form.name.trim(),
        admin_name: form.admin_name.trim(),
        admin_phone: form.admin_phone.trim(),
        admin_email: form.admin_email.trim() || undefined,
        admin_password: form.admin_password,
      }),
    onSuccess: (org) => {
      if (logoFile) {
        logoMutation.mutate({ orgId: org.id, file: logoFile });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast(`Organization "${org.name}" created`, "success");
      reset();
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't create organization.", "error"),
  });

  const isBusy = mutation.isPending || logoMutation.isPending;
  const canSubmit =
    !!form.name.trim() &&
    !!form.admin_name.trim() &&
    !!form.admin_phone.trim() &&
    form.admin_password.length >= 6;

  function close() {
    if (isBusy) return;
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create New Organization"
      footer={
        <>
          <button className="btn-ghost" onClick={close} disabled={isBusy}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!canSubmit || isBusy} onClick={() => mutation.mutate()}>
            {isBusy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {logoMutation.isPending ? "Uploading logo…" : mutation.isPending ? "Creating…" : "Create Organization"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="new-org-name" className="text-xs font-medium text-ink-500 mb-1.5 block">Organization name</label>
          <input id="new-org-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-medium text-ink-500">Organization logo <span className="text-ink-300">(optional)</span></label>
            <span className="text-[10px] text-ink-400">PNG, JPG or WebP · max 5 MB</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-[#FBFAF7] p-3">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-white">
              {logoPreview ? <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus size={21} className="text-ink-300" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">
                <ImagePlus size={14} aria-hidden="true" />
                {logoFile ? "Replace logo" : "Choose logo"}
                <input type="file" accept={LOGO_ACCEPT} className="sr-only" onChange={handleLogoChange} />
              </label>
              {logoFile && (
                <button type="button" className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline" onClick={() => setLogoFile(null)}>
                  <X size={13} aria-hidden="true" /> Remove
                </button>
              )}
              <p className="mt-1.5 truncate text-[11px] text-ink-400">{logoFile ? logoFile.name : "Shown across this organization’s workspace after sign-in."}</p>
            </div>
          </div>
          {logoError && <p role="alert" className="mt-1.5 text-xs text-danger">{logoError}</p>}
        </div>

        <div className="h-px bg-ink-100" />
        <p className="text-xs font-semibold text-ink-700">First Admin</p>
        <div>
          <label htmlFor="new-org-admin-name" className="text-xs font-medium text-ink-500 mb-1.5 block">Name</label>
          <input id="new-org-admin-name" className="input" required value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="new-org-admin-phone" className="text-xs font-medium text-ink-500 mb-1.5 block">Phone</label>
          <input id="new-org-admin-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" required minLength={6} value={form.admin_phone} onChange={(e) => setForm({ ...form, admin_phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="new-org-admin-email" className="text-xs font-medium text-ink-500 mb-1.5 block">Email (optional)</label>
          <input id="new-org-admin-email" className="input" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="new-org-admin-password" className="text-xs font-medium text-ink-500 mb-1.5 block">Temporary password</label>
          <input id="new-org-admin-password" className="input" type="password" autoComplete="new-password" required minLength={6} value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} placeholder="Minimum 6 characters" />
        </div>
      </div>
    </Modal>
  );
}
