"use client";

import { Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { AreaSelector } from "./AreaSelector";
import { GenreSelector } from "./GenreSelector";

interface StyleInputsProps {
  data: ProfileFormData;
  onChange: (key: keyof ProfileFormData, value: any) => void;
}

// Simplified Select Component (Radio-like Button Group)
const SelectGroup = ({
  label,
  options,
  value,
  onChange,
  description,
}: {
  label: string;
  options: { label: string; value: string; desc?: string }[];
  value: string;
  onChange: (val: any) => void;
  description?: string;
}) => (
  <div className="space-y-2">
    <Label className="block text-sm font-bold text-text-secondary">
      {label}
      {description && (
        <span className="ml-2 text-xs font-normal text-text-muted">
          {description}
        </span>
      )}
    </Label>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          variant={value === opt.value ? "default" : "outline"}
          className={`flex h-auto flex-col items-center justify-center gap-1 rounded-xl p-3 text-center transition-all ${value === opt.value
              ? "bg-role-cast-lighter text-role-cast border-role-cast ring-1 ring-role-cast hover:bg-role-cast-light hover:text-role-cast-hover"
              : "border-border bg-surface text-text-secondary hover:border-border-secondary hover:bg-surface-secondary"
            }`}
        >
          <span className="text-sm font-bold">{opt.label}</span>
          {opt.desc && (
            <span className="text-[10px] opacity-70">{opt.desc}</span>
          )}
        </Button>
      ))}
    </div>
  </div>
);

export const StyleInputs = ({
  data,
  onChange,
}: StyleInputsProps) => {
  return (
    <section className="space-y-6 rounded-2xl bg-surface p-5 shadow-sm border border-border">
      <h3 className="flex items-center gap-2 text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border pb-2">
        <Info size={14} /> Style Definition
      </h3>

      {/* Default Schedule */}
      <div>
        <Label className="block text-sm font-bold text-text-secondary mb-1">
          Standard Schedule Time
          <span className="ml-2 text-xs font-normal text-text-muted">
            基本の活動時間設定
          </span>
        </Label>
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="time"
            value={data.defaultScheduleStart}
            onChange={(e) => onChange("defaultScheduleStart", e.target.value)}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-role-cast focus:border-transparent"
          />
          <span className="text-text-muted font-bold">~</span>
          <input
            type="time"
            value={data.defaultScheduleEnd}
            onChange={(e) => onChange("defaultScheduleEnd", e.target.value)}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-role-cast focus:border-transparent"
          />
        </div>
      </div>

      {/* Genre */}
      <div>
        <Label className="block text-sm font-bold text-text-secondary mb-1">
          Genre
          <span className="ml-2 text-xs font-normal text-text-muted">
            活動ジャンル（最低1つ、最大3つ）
          </span>
        </Label>
        <GenreSelector
          selectedIds={data.genreIds || []}
          onChange={(ids) => onChange("genreIds", ids)}
          maxSelections={3}
        />
      </div>

      {/* Area */}
      <div>
        <Label className="block text-sm font-bold text-text-secondary mb-1">
          Area
          <span className="ml-2 text-xs font-normal text-text-muted">
            活動エリア（最大3つ）
          </span>
        </Label>
        <AreaSelector
          selectedIds={data.areaIds || []}
          onChange={(ids) => onChange("areaIds", ids)}
          maxSelections={3}
        />
      </div>
    </section>
  );
};
