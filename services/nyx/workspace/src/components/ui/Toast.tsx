"use client";

import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { toastVariants, springTransition } from "@/lib/motion";

type ToastVariant = "default" | "success" | "destructive";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  toast: (props: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((props: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...props, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss: removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}) {
  const actionCalled = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const Icon = toast.variant === "destructive" ? AlertCircle : CheckCircle;
  const iconColor =
    toast.variant === "destructive" ? "text-error" : "text-success";

  const handleAction = () => {
    if (actionCalled.current || !toast.action) return;
    actionCalled.current = true;
    toast.action.onClick();
    onRemove(toast.id);
  };

  return (
    <motion.div
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={springTransition}
      className="pointer-events-auto bg-surface rounded-lg shadow-lg border border-border p-4 min-w-[280px] max-w-sm flex items-start gap-3"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-sm text-text-secondary mt-0.5">{toast.description}</p>
        )}
      </div>
      {toast.action && (
        <button
          onClick={handleAction}
          className="flex-shrink-0 text-sm font-bold text-accent hover:text-accent-hover transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-text-muted hover:text-text-secondary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
