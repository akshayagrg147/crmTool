import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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
  const Icon = danger ? AlertTriangle : CheckCircle2;

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isLoading ? "Please wait…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4 py-1">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            danger
              ? "border-danger/20 bg-danger/[0.08] text-danger"
              : "border-secondary/20 bg-secondary/10 text-secondary"
          }`}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div className="pt-0.5">
          <p className="text-sm leading-6 text-ink-700">{message}</p>
        </div>
      </div>
    </Modal>
  );
}
