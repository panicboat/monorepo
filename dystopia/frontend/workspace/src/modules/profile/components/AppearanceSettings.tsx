"use client";

import { useSyncExternalStore } from "react";
import { useTheme, type ThemeChoice } from "@/components/providers/ThemeProvider";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "システム" },
];

// useSyncExternalStore with a no-op subscribe returns false on the server
// and true on the client, preventing hydration mismatches without setState in effects.
const subscribe = () => () => {};

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div className="flex flex-col gap-3 py-4">
      <h2 className="text-sm font-semibold text-text-secondary">テーマ</h2>
      <div role="radiogroup" aria-label="テーマ" className="flex flex-col gap-2">
        {OPTIONS.map((opt) => {
          const selected = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center justify-between rounded-md border px-4 py-3 text-left text-sm ${
                selected
                  ? "border-accent text-text-primary"
                  : "border-border text-text-secondary hover:bg-bg-secondary"
              }`}
            >
              <span>{opt.label}</span>
              <span
                aria-hidden="true"
                className={`h-4 w-4 rounded-full border ${
                  selected ? "border-accent bg-accent" : "border-border"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
