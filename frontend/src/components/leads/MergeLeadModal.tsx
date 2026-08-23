import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { leadsApi } from "@/api/endpoints";
import { useToast } from "@/hooks/useToast";
import type { LeadOut } from "@/api/types";

export function MergeLeadModal({ lead, onClose }: { lead: LeadOut | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [duplicateId, setDuplicateId] = useState("");
  const { data: matches, isLoading } = useQuery({
    queryKey: ["duplicate-leads", lead?.phone],
    queryFn: () => leadsApi.checkDuplicate(lead!.phone),
    enabled: !!lead,
  });
  const duplicates = useMemo(() => matches?.filter((match) => match.id !== lead?.id) ?? [], [matches, lead?.id]);

  useEffect(() => {
    setDuplicateId("");
  }, [lead?.id]);

  const mergeMutation = useMutation({
    mutationFn: () => leadsApi.merge(lead!.id, duplicateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Duplicate lead merged. Its calls and tasks are now on the primary record.", "success");
      onClose();
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't merge the leads.", "error"),
  });

  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      title="Merge duplicate lead"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!duplicateId || mergeMutation.isPending} onClick={() => mergeMutation.mutate()}>
            {mergeMutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Merging…</> : <><GitMerge size={15} /> Merge into {lead?.name}</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-sm text-ink-700">
          The primary record stays active. Calls, tasks, assignment history, and missing profile details from the duplicate are preserved.
        </div>
        {isLoading ? (
          <p className="text-sm text-ink-500">Looking for matching phone numbers…</p>
        ) : duplicates.length ? (
          <label className="block text-sm text-ink-700">
            Duplicate record
            <select className="input mt-1.5" value={duplicateId} onChange={(event) => setDuplicateId(event.target.value)}>
              <option value="">Choose a duplicate</option>
              {duplicates.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.name} · {match.phone} · {match.status.replace("_", " ")}{match.assignee_name ? ` · ${match.assignee_name}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-lg border border-dashed border-ink-100 px-3.5 py-4 text-center text-sm text-ink-500">
            No other lead uses {lead?.phone}. This lead may already have been merged.
          </p>
        )}
      </div>
    </Modal>
  );
}
