"use client";

import { useState, useCallback } from "react";
import { Loader2, Save, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionButtonMode = "save" | "submit";
type ColorScheme = "blue" | "pink";

interface ActionButtonProps {
  mode?: ActionButtonMode;
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  successDuration?: number;
  colorScheme?: ColorScheme;
}

export function ActionButton({
  mode = "save",
  label,
  loadingLabel,
  successLabel,
  onClick,
  disabled = false,
  className,
  successDuration = 2000,
  colorScheme = "blue",
}: ActionButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleClick = useCallback(async () => {
    if (status !== "idle" || disabled) return;

    setStatus("loading");
    try {
      await onClick();
      if (mode === "save") {
        setStatus("success");
        setTimeout(() => setStatus("idle"), successDuration);
      } else {
        // For submit mode, the page typically navigates away
        // Keep loading state in case navigation is slow
        setStatus("idle");
      }
    } catch (error) {
      setStatus("idle");
      throw error;
    }
  }, [onClick, disabled, status, mode, successDuration]);

  const isDisabled = disabled || status === "loading" || status === "success";

  // Determine display text
  const displayLabel =
    status === "loading"
      ? loadingLabel || (mode === "save" ? "Saving..." : "Loading...")
      : status === "success"
        ? successLabel || "Saved!"
        : label;

  // Determine icon
  const Icon =
    status === "loading"
      ? Loader2
      : status === "success"
        ? Check
        : mode === "save"
          ? Save
          : ArrowRight;

  const iconPosition = mode === "submit" ? "right" : "left";

  return (
    <button
      type={mode === "submit" ? "submit" : "button"}
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50",
        status === "success"
          ? "bg-green-500"
          : status === "loading"
            ? colorScheme === "pink"
              ? "bg-pink-300 cursor-not-allowed"
              : "bg-blue-300 cursor-not-allowed"
            : colorScheme === "pink"
              ? "bg-pink-500 hover:bg-pink-600 shadow-pink-200 hover:shadow-pink-300"
              : "bg-blue-400 hover:bg-blue-500 shadow-blue-200 hover:shadow-blue-300",
        className
      )}
    >
      {iconPosition === "left" && (
        <Icon size={18} className={status === "loading" ? "animate-spin" : ""} />
      )}
      <span>{displayLabel}</span>
      {iconPosition === "right" && (
        <Icon size={18} className={status === "loading" ? "animate-spin" : ""} />
      )}
    </button>
  );
}

// Hook for external control of save state with toast integration
interface UseSaveActionOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  successDuration?: number;
}

export function useSaveAction(options: UseSaveActionOptions = {}) {
  const { onSuccess, onError, successDuration = 2000 } = options;
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const execute = useCallback(
    async (action: () => Promise<void>) => {
      setStatus("saving");
      try {
        await action();
        setStatus("saved");
        onSuccess?.();
        setTimeout(() => setStatus("idle"), successDuration);
      } catch (error) {
        setStatus("idle");
        onError?.(error as Error);
        throw error;
      }
    },
    [onSuccess, onError, successDuration]
  );

  return {
    status,
    saving: status === "saving",
    saved: status === "saved",
    execute,
  };
}
