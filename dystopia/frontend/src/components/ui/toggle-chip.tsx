"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToggleChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function ToggleChip({ pressed, onClick, children }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm",
        pressed ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}
