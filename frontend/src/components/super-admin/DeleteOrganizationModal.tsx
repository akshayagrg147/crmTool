import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { OrganizationOut } from "@/api/types";

export function DeleteOrganizationModal({
  organization,
  onClose,
  onConfirm,
  isLoading,
}: {
  organization: OrganizationOut | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    setConfirmation("");
  }, [organization?.id]);

  const matches = !!organization && confirmation === organization.name;

  return (
    <Modal
      open={!!organization}
      onClose={isLoading ? () => undefined : onClose}
      title="Delete Organization Permanently"
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={!matches || isLoading}>
            {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isLoading ? "Deleting…" : "Delete Permanently"}
          </button>
        </>
      }
    >
      {organization && (
        <div>
          <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/[0.06] p-3.5">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink-900">This action cannot be undone.</p>
              <p className="mt-1 text-xs leading-5 text-ink-600">
                This permanently deletes {organization.user_count} users, {organization.lead_count} leads, call history, categories, settings, and integrations belonging to this organization.
              </p>
            </div>
          </div>
          <label htmlFor="delete-org-confirmation" className="mb-1.5 mt-5 block text-xs font-medium text-ink-600">
            Type <strong className="text-ink-900">{organization.name}</strong> to confirm
          </label>
          <input
            id="delete-org-confirmation"
            className="input"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={isLoading}
          />
        </div>
      )}
    </Modal>
  );
}
