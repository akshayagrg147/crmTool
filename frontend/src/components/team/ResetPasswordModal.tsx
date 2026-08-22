import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { usersApi } from "@/api/endpoints";
import { useToast } from "@/hooks/useToast";
import { Modal } from "@/components/Modal";
import type { TeamMemberOut } from "@/api/types";

interface ResetPasswordModalProps {
  open: boolean;
  member: TeamMemberOut | null;
  onClose: () => void;
}

export function ResetPasswordModal({ open, member, onClose }: ResetPasswordModalProps) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const resetMutation = useMutation({
    mutationFn: () => usersApi.resetPassword(member!.id, newPassword),
    onSuccess: () => {
      toast(`Password updated for ${member?.name ?? "the telecaller"}.`, "success");
      onClose();
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't update the password.", "error"),
  });

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = Boolean(member && newPassword.length >= 6 && passwordsMatch && !resetMutation.isPending);

  return (
    <Modal
      open={open}
      onClose={resetMutation.isPending ? () => undefined : onClose}
      title="Change telecaller password"
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={resetMutation.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => resetMutation.mutate()}
            disabled={!canSubmit}
            aria-busy={resetMutation.isPending}
          >
            {resetMutation.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {resetMutation.isPending ? "Updating..." : "Set new password"}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-primary/10 bg-primary-soft/40 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
          <KeyRound size={17} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">{member?.name}</p>
          <p className="mt-0.5 text-xs text-ink-500">{member?.phone}</p>
          <p className="mt-2 text-xs leading-5 text-ink-600">
            This replaces the current password immediately. Share the new password with the telecaller securely.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="telecaller-new-password" className="mb-1.5 block text-xs font-semibold text-ink-700">
            New temporary password <span className="text-danger">*</span>
          </label>
          <input
            id="telecaller-new-password"
            className="input w-full"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label htmlFor="telecaller-confirm-password" className="mb-1.5 block text-xs font-semibold text-ink-700">
            Confirm new password <span className="text-danger">*</span>
          </label>
          <input
            id="telecaller-confirm-password"
            className="input w-full"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat the new password"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="mt-1.5 text-xs text-danger">Passwords do not match.</p>
          )}
        </div>

        <p className="flex items-start gap-2 text-xs leading-5 text-ink-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
          The password is stored securely and is never shown again after this update.
        </p>
      </div>
    </Modal>
  );
}
