import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Tags } from "lucide-react";
import { leadsApi } from "@/api/endpoints";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";

export function CategoryManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { data: categories, isLoading } = useQuery({
    queryKey: ["lead-categories"],
    queryFn: leadsApi.categories,
    enabled: open,
  });

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => leadsApi.createCategory(name.trim()),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ["lead-categories"] });
      toast(`${category.label} category created`, "success");
      setName("");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't create the category.", "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Lead Categories" size="md">
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3 flex gap-2.5">
          <Tags size={17} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-ink-600 leading-relaxed">
            Create workspace categories here. They will immediately be available to managers and telecallers when adding or updating a lead.
          </p>
        </div>

        <div>
          <label htmlFor="new-category-name" className="mb-1.5 block text-xs font-medium text-ink-500">New category name</label>
          <div className="flex gap-2">
            <input
              id="new-category-name"
              className="input flex-1"
              placeholder="e.g. High Value, Hospital Chain"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim() && !mutation.isPending) mutation.mutate();
              }}
            />
            <button className="btn-primary shrink-0" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
              <Plus size={16} /> {mutation.isPending ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Available categories</p>
          {isLoading ? (
            <p className="text-sm text-ink-400">Loading categories...</p>
          ) : !categories?.length ? (
            <p className="rounded-lg border border-dashed border-ink-100 px-3 py-5 text-center text-sm text-ink-400">No categories are available yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories?.map((category) => (
                <div key={category.value} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-700">
                  <CheckCircle2 size={15} className={category.is_custom ? "text-primary" : "text-success"} />
                  <span>{category.label}</span>
                  {category.is_custom && <span className="ml-auto text-[10px] uppercase tracking-wide text-primary">Custom</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
