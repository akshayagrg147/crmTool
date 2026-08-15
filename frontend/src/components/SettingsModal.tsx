import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Building2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { authApi, organizationApi } from "@/api/endpoints";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [orgName, setOrgName] = useState("");

  const { data: org } = useQuery({
    queryKey: ["organization"],
    queryFn: organizationApi.get,
    enabled: open && user?.role !== "super_admin",
  });

  useEffect(() => {
    if (org) setOrgName(org.name);
  }, [org]);

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast("Password updated", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't update password.", "error"),
  });

  const orgMutation = useMutation({
    mutationFn: () => organizationApi.update(orgName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast("Organization name updated", "success");
    },
    onError: () => toast("Couldn't update organization name.", "error"),
  });

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPassword = currentPassword && newPassword.length >= 6 && passwordsMatch;

  return (
    <Modal open={open} onClose={onClose} title="Account Settings" size="md">
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={16} className="text-ink-500" />
            <h4 className="text-sm font-semibold text-ink-900">Change Password</h4>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">Current password</label>
              <input
                type="password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">New password</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">Confirm new password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-danger mt-1.5">Passwords don't match</p>
              )}
            </div>
            <button
              className="btn-primary self-start text-sm"
              disabled={!canSubmitPassword || passwordMutation.isPending}
              onClick={() => passwordMutation.mutate()}
            >
              {passwordMutation.isPending ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>

        {isAdmin && org && (
          <div>
            <div className="h-px bg-ink-100 mb-6" />
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={16} className="text-ink-500" />
              <h4 className="text-sm font-semibold text-ink-900">Organization</h4>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1.5 block">Organization name</label>
                <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <button
                className="btn-secondary self-start text-sm"
                disabled={!orgName || orgName === org.name || orgMutation.isPending}
                onClick={() => orgMutation.mutate()}
              >
                {orgMutation.isPending ? "Saving..." : "Save Organization Name"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
