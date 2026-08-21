import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { leadsApi } from "@/api/endpoints";
import type { LeadOut } from "@/api/types";

export function ChangeCategoryModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadOut | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(lead?.interested_categories ?? [lead?.category ?? "other"]);
  const { data: categories, isLoading } = useQuery({
    queryKey: ["lead-categories"],
    queryFn: leadsApi.categories,
    enabled: open,
  });

  useEffect(() => {
    if (open && lead) setSelectedCategories(lead.interested_categories?.length ? lead.interested_categories : [lead.category]);
  }, [open, lead]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error("No lead selected");
      return leadsApi.update(lead.id, {
        category: selectedCategories[0] ?? lead.category,
        interested_categories: selectedCategories,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Lead category updated", "success");
      onClose();
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't update the category.", "error"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change Category${lead ? ` — ${lead.name}` : ""}`}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={!lead || !selectedCategories.length || isLoading || mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Category"}
          </button>
        </>
      }
    >
      <div>
        <p className="text-xs font-medium text-ink-500 mb-1.5">Categories of interest</p>
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 bg-[#FCFCFA] p-3">
          {isLoading ? (
            <p className="py-3 text-center text-sm text-ink-400">Loading categories…</p>
          ) : !categories?.length ? (
            <p className="py-3 text-center text-sm text-ink-400">No categories are available.</p>
          ) : categories.map((option) => {
            const checked = selectedCategories.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-bg cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-primary"
                  checked={checked}
                  disabled={isLoading}
                  onChange={() =>
                    setSelectedCategories((current) =>
                      checked ? current.filter((value) => value !== option.value) : [...current, option.value]
                    )
                  }
                />
                <span>{option.label}</span>
                {option.is_custom && <span className="text-[10px] uppercase tracking-wide text-primary ml-auto">Custom</span>}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-ink-400 mt-2">Select every category this customer is interested in.</p>
      </div>
    </Modal>
  );
}
