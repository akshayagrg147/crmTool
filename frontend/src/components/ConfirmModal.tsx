import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = true,
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className={danger ? "btn-primary" : "btn-secondary"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Please wait..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="shrink-0 h-10 w-10 rounded-full bg-danger/10 flex items-center justify-center animate-pulse-ring">
          <AlertTriangle size={20} className="text-danger" />
        </div>
        <p className="text-sm text-ink-700 pt-2 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          {message}
        </p>
      </div>
    </Modal>
  );
}
