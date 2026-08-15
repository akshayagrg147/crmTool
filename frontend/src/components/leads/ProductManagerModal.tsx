import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Package } from "lucide-react";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/useToast";
import { productsApi } from "@/api/endpoints";

export function ProductManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, enabled: open });

  const createMutation = useMutation({
    mutationFn: () => productsApi.create({ name, sku: sku || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast("Product added", "success");
      setName("");
      setSku("");
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't add product.", "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast("Product removed", "success");
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't remove product.", "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Manage Products" size="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">Product name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cardivas 10mg" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">SKU (optional)</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. CRD-010" />
          </div>
        </div>
        <button className="btn-primary self-start text-sm" disabled={!name || createMutation.isPending} onClick={() => createMutation.mutate()}>
          <Plus size={16} /> Add Product
        </button>

        <div className="h-px bg-ink-100" />

        {!products?.length ? (
          <EmptyState icon={Package} title="No products yet" message="Add your product catalog above to tag leads and orders." />
        ) : (
          <div className="flex flex-col divide-y divide-ink-100">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-900">{p.name}</p>
                  {p.sku && <p className="text-xs text-ink-500">{p.sku}</p>}
                </div>
                <button className="p-1.5 rounded-full hover:bg-danger/10 text-danger" onClick={() => removeMutation.mutate(p.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
