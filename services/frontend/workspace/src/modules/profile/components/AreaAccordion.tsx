"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AreaView } from "@/modules/profile/types";

interface AreaAccordionProps {
  areas: AreaView[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}

// spec の 8 地方順
const REGION_ORDER = [
  "北海道・東北", "関東", "甲信越・北陸", "東海", "関西", "中国", "四国", "九州・沖縄",
];

export function AreaAccordion({ areas, selectedIds, onChange, max = 2 }: AreaAccordionProps) {
  const [openRegion, setOpenRegion] = useState<string | null>(null);

  const byRegion = new Map<string, Map<string, AreaView[]>>();
  for (const a of areas) {
    const region = a.region || "その他";
    if (!byRegion.has(region)) byRegion.set(region, new Map());
    const byPref = byRegion.get(region)!;
    if (!byPref.has(a.prefecture)) byPref.set(a.prefecture, []);
    byPref.get(a.prefecture)!.push(a);
  }

  const regions = REGION_ORDER.filter((r) => byRegion.has(r)).concat(
    [...byRegion.keys()].filter((r) => !REGION_ORDER.includes(r))
  );

  const selected = new Set(selectedIds);
  const atMax = selected.size >= max;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < max) next.add(id);
    onChange([...next]);
  };

  const regionCount = (region: string) => {
    let n = 0;
    for (const list of byRegion.get(region)!.values()) {
      for (const a of list) if (selected.has(a.id)) n++;
    }
    return n;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">最大{max}エリアまで選択できます</p>
        <p className="text-sm text-accent">
          {selected.size}/{max}件選択中
        </p>
      </div>
      <div className="flex flex-col rounded-md border border-border">
        {regions.map((region) => {
          const open = openRegion === region;
          const count = regionCount(region);
          return (
            <div key={region} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenRegion(open ? null : region)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-text-primary"
              >
                <span>
                  {region}
                  {count > 0 && <span className="ml-1 text-accent">({count})</span>}
                </span>
                <svg
                  className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {open && (
                <div className="flex flex-col gap-3 px-4 pb-3">
                  {[...byRegion.get(region)!.entries()].map(([pref, list]) => (
                    <div key={pref} className="flex flex-col gap-1.5">
                      <p className="text-xs text-text-muted">{pref}</p>
                      <div className="flex flex-wrap gap-2">
                        {list.map((a) => {
                          const on = selected.has(a.id);
                          const disabled = !on && atMax;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggle(a.id)}
                              disabled={disabled}
                              className={cn(
                                "rounded-full border px-3 py-1 text-sm transition-colors",
                                on
                                  ? "border-accent bg-accent/15 text-accent"
                                  : "border-border text-text-secondary hover:text-text-primary",
                                disabled && "opacity-40"
                              )}
                            >
                              {a.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
