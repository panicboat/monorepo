import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  tone: "warning" | "success";
  children: ReactNode;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-bold",
        tone === "warning" ? "border-warning/50 bg-warning/10 text-warning" : "border-success-text/50 bg-success-text/10 text-success-text"
      )}
    >
      {children}
    </span>
  );
}
