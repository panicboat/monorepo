"use client";

import { Select } from "@/components/ui/select";

interface KarteRatingSelectProps {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
}

export function KarteRatingSelect({ value, onChange, disabled }: KarteRatingSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      予約・接客の信頼性
      <Select
        value={value === null ? "" : String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">未評価</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)}
            {"☆".repeat(5 - n)} ({n})
          </option>
        ))}
      </Select>
    </label>
  );
}
