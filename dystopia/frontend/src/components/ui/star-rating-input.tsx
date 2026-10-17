"use client";

import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarRatingInputProps {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}

export function StarRatingInput({ label, value, onChange, disabled }: StarRatingInputProps) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star}つ星`}
          aria-pressed={value === star}
          onClick={() => onChange(value === star ? null : star)}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg text-2xl disabled:opacity-50",
            value !== null && star <= value ? "text-rating" : "text-text-muted hover:text-text-secondary"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}
