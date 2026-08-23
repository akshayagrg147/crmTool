import { useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";

export interface SavedLeadView {
  id: string;
  name: string;
  filters: {
    q: string;
    source: string;
    status: string;
    assignee: string;
    category: string;
    city: string;
    callback: string;
  };
}

export function SaveLeadViewModal({
  open,
  onClose,
  views,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  views: SavedLeadView[];
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save lead view"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => { onSave(name.trim()); onClose(); }}>
            <Bookmark size={15} /> Save view
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm text-ink-700">
          View name
          <input autoFocus className="input mt-1.5" placeholder="e.g. High-priority callbacks" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <p className="text-xs text-ink-500">This saves the current search and filters for your workspace.</p>
        {views.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Saved views</p>
            <div className="space-y-1.5">
              {views.map((view) => (
                <div key={view.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
                  <span className="text-ink-700">{view.name}</span>
                  <button className="btn-icon text-danger" aria-label={`Delete saved view ${view.name}`} onClick={() => onDelete(view.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
