"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  allowUnrated: boolean;
  disabled?: boolean;
}

export function RatingInput({ value, onChange, allowUnrated, disabled }: RatingInputProps) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="評価" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button key={rating} type="button" role="radio" aria-label={`${rating}つ星`} aria-checked={value === rating} disabled={disabled} tabIndex={value === rating || (value === null && rating === 1) ? 0 : -1}
            className={cn("grid size-11 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50", value !== null && rating <= value ? "text-warning" : "text-text-muted")}
            onClick={() => onChange(rating)}
            onKeyDown={(event) => {
              const next = event.key === "Home" ? 1 : event.key === "End" ? 5 : ["ArrowRight", "ArrowUp"].includes(event.key) ? rating % 5 + 1 : ["ArrowLeft", "ArrowDown"].includes(event.key) ? (rating + 3) % 5 + 1 : null;
              if (next === null) return;
              event.preventDefault(); onChange(next);
              (event.currentTarget.parentElement?.querySelector(`[aria-label="${next}つ星"]`) as HTMLButtonElement | null)?.focus();
            }}
          ><Star aria-hidden="true" className={cn("size-8", value !== null && rating <= value && "fill-current")} /></button>
        ))}
        <span className="ml-2 text-sm text-text-secondary">{value === null ? "未評価" : `${value} / 5`}</span>
      </div>
      {allowUnrated && <button type="button" onClick={() => onChange(null)} disabled={disabled || value === null} className="min-h-10 text-sm font-medium text-accent disabled:text-text-muted">未評価にする</button>}
    </div>
  );
}
