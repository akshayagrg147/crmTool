import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArchiveX } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { leadsApi } from "@/api/endpoints";
import type { LeadOut, TeamMemberOut } from "@/api/types";

export function MarkLostModal({
  open,
  onClose,
  lead,
  managers,
  managersLoading,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadOut | null;
  managers: TeamMemberOut[];
  managersLoading: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [managerId, setManagerId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setManagerId(managers[0]?.id ?? "");
      setReason("");
    }
  }, [open, managers]);

  const mutation = useMutation({
    mutationFn: () => leadsApi.markLost(lead!.id, { manager_id: managerId, reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["lost-deals"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-history"] });
      toast("Lead marked as lost and sent to the manager", "success");
      onClose();
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't mark the lead as lost.", "error"),
  });

  if (!lead) return null;

  const canSubmit = Boolean(managerId && reason.trim().length >= 3 && !managersLoading && !mutation.isPending);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark Lost — ${lead.name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-danger" disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Sending..." : "Mark Lost & Send"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-warning/20 bg-warning/5 px-3.5 py-3 flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-ink-700 leading-relaxed">
            This will mark the lead as Lost, record the telecaller who reported it, and move it to the selected manager.
            Use this for cases such as an invalid or short contact number.
          </p>
        </div>

        <div>
          <label htmlFor="lost-manager" className="text-xs font-medium text-ink-500 mb-1.5 block">Send to manager <span className="text-danger">*</span></label>
          <select
            id="lost-manager"
            className="input"
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
            disabled={managersLoading || mutation.isPending}
          >
            <option value="">{managersLoading ? "Loading managers..." : "Choose a manager..."}</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
          {!managersLoading && !managers.length && (
            <p className="text-xs text-danger mt-1.5">No active manager is available for this handoff.</p>
          )}
        </div>

        <div>
          <label htmlFor="lost-reason" className="text-xs font-medium text-ink-500 mb-1.5 block">Why is this deal lost? <span className="text-danger">*</span></label>
          <textarea
            id="lost-reason"
            className="input min-h-[110px] resize-y"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: Phone number has only nine digits and could not be contacted."
            disabled={mutation.isPending}
          />
          <p className="text-xs text-ink-400 mt-1.5">Add enough detail so the manager knows what happened.</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-500">
          <ArchiveX size={14} className="text-danger" /> This action removes the lead from your active queue.
        </div>
      </div>
    </Modal>
  );
}
