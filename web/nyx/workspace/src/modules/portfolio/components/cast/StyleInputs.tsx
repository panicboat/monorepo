"use client";

import { Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";

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
    <Label className="block text-sm font-bold text-slate-700">
      {label}
      {description && (
        <span className="ml-2 text-xs font-normal text-slate-400">
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
              ? "bg-pink-50 text-pink-600 border-pink-500 ring-1 ring-pink-500 hover:bg-pink-100 hover:text-pink-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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
    <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2">
        <Info size={14} /> Style Definition
      </h3>

      <SelectGroup
        label="1. Service Category"
        description="提供するサービスの内容"
        value={data.serviceCategory}
        onChange={(val) => onChange("serviceCategory", val)}
        options={[
          { label: "Advanced", value: "advanced", desc: "濃厚接触" },
          { label: "Standard", value: "standard", desc: "ソフト" },
          { label: "Social", value: "social", desc: "飲食" },
        ]}
      />

      <SelectGroup
        label="2. Location Type"
        description="主な活動場所"
        value={data.locationType}
        onChange={(val) => onChange("locationType", val)}
        options={[
          { label: "Store", value: "store", desc: "店舗型" },
          { label: "Dispatch", value: "dispatch", desc: "派遣" },
          { label: "Hotel", value: "hotel", desc: "ホテル" },
        ]}
      />

      {/* Default Schedule */}
      <div>
        <Label className="block text-sm font-bold text-slate-700 mb-1">
          3. Standard Schedule Time
          <span className="ml-2 text-xs font-normal text-slate-400">
            基本の活動時間設定
          </span>
        </Label>
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="time"
            value={data.defaultScheduleStart}
            onChange={(e) => onChange("defaultScheduleStart", e.target.value)}
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
          <span className="text-slate-400 font-bold">~</span>
          <input
            type="time"
            value={data.defaultScheduleEnd}
            onChange={(e) => onChange("defaultScheduleEnd", e.target.value)}
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>
    </section>
  );
};
