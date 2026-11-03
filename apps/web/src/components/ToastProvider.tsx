import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((kind: ToastKind, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const id = ++nextToastId;
    setToasts((current) => [...current.slice(-3), { id, kind, message: trimmed }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => addToast("success", message),
      error: (message) => addToast("error", message),
      info: (message) => addToast("info", message)
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm sm:items-stretch"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), 4500);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, paused, toast.id]);

  const styles = {
    success: {
      icon: CheckCircle2,
      role: "status" as const,
      color: "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-200"
    },
    error: {
      icon: XCircle,
      role: "alert" as const,
      color: "border-rose-200 bg-white text-rose-800 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-200"
    },
    info: {
      icon: Info,
      role: "status" as const,
      color: "border-indigo-200 bg-white text-indigo-800 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-200"
    }
  }[toast.kind];
  const Icon = styles.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role={styles.role}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles.color}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-5">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand dark:hover:bg-white/10"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
