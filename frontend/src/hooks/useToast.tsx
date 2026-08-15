import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;
const AUTO_DISMISS_MS = 4000;
const EXIT_ANIM_MS = 200;

const kindStyles: Record<ToastKind, { icon: typeof CheckCircle2; iconWrap: string; accent: string }> = {
  success: { icon: CheckCircle2, iconWrap: "bg-success/10 text-success", accent: "bg-success" },
  error: { icon: XCircle, iconWrap: "bg-danger/10 text-danger", accent: "bg-danger" },
  info: { icon: Info, iconWrap: "bg-secondary/10 text-secondary", accent: "bg-secondary" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_ANIM_MS);
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const cfg = kindStyles[t.kind];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className={`relative overflow-hidden card flex items-start gap-3 pl-4 pr-3 py-3.5 pointer-events-auto transition-all duration-200 ease-smooth ${
                t.leaving ? "opacity-0 translate-x-3 scale-[0.98]" : "animate-slide-in-right"
              }`}
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.accent}`} />
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.iconWrap}`}>
                <Icon size={16} />
              </div>
              <p className="text-sm text-ink-900 flex-1 pt-1.5 leading-snug">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-ink-300 hover:text-ink-700 rounded-full p-1 hover:bg-ink-100 transition-colors mt-1"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
