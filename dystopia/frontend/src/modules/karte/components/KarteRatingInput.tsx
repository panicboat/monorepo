"use client";

import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface KarteRatingInputProps {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}

export function KarteRatingInput({ value, onChange, disabled }: KarteRatingInputProps) {
  return (
    <div role="group" aria-label="予約・接客の信頼性" className="flex gap-1">
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
