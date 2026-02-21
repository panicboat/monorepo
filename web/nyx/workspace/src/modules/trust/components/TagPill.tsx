"use client";

import { X, Loader2 } from "lucide-react";

interface TagPillProps {
  name: string;
  onRemove?: () => void;
  removing?: boolean;
}

export function TagPill({ name, onRemove, removing }: TagPillProps) {
  const baseClasses = "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-surface-secondary text-text-secondary";

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
