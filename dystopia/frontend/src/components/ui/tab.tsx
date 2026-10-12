"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("flex overflow-x-auto border-b border-divider bg-bg no-scrollbar", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-[17px] py-3.5 text-sm font-bold transition-colors",
              active
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-secondary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
