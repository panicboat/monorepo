"use client";

import { X, Loader2 } from "lucide-react";

interface TagPillProps {
  name: string;
  variant?: "default" | "cast" | "guest";
  onRemove?: () => void;
  removing?: boolean;
}

export function TagPill({ name, variant = "default", onRemove, removing }: TagPillProps) {
  const variantClasses = {
    default: "bg-surface-secondary text-text-secondary",
    cast: "bg-role-cast/10 text-role-cast",
    guest: "bg-info/10 text-info",
  };

  const baseClasses = `inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${variantClasses[variant]}`;

  return (
    <span className={baseClasses}>
      <span>#</span>
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="ml-0.5 rounded-full bg-surface/50 p-0.5 hover:bg-surface transition-colors disabled:opacity-50"
        >
          {removing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </button>
      )}
    </span>
  );
}
