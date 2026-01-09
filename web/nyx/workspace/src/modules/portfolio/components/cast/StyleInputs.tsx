"use client";

import { Info, Clock } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";

interface StyleInputsProps {
  data: ProfileFormData;
  onChange: (key: keyof ProfileFormData, value: any) => void;
  timeOptions: string[];
}

// Simplified Select Component
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
    <label className="block text-sm font-bold text-slate-700">
      {label}
      {description && (
        <span className="ml-2 text-xs font-normal text-slate-400">
          {description}
        </span>
      )}
    </label>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all ${
            value === opt.value
              ? "border-pink-500 bg-pink-50 text-pink-600 ring-1 ring-pink-500"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className="text-sm font-bold">{opt.label}</span>
          {opt.desc && (
            <span className="text-[10px] opacity-70">{opt.desc}</span>
          )}
        </button>
      ))}
    </div>
  </div>
);

export const StyleInputs = ({
  data,
  onChange,
  timeOptions,
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
        <label className="block text-sm font-bold text-slate-700 mb-1">
          3. Standard Shift Time
          <span className="ml-2 text-xs font-normal text-slate-400">
            基本の活動時間設定
          </span>
        </label>
        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <select
              value={data.defaultShiftStart}
              onChange={(e) => onChange("defaultShiftStart", e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-pink-500 focus:outline-none"
            >
              {timeOptions.map((t) => (
                <option key={`start-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Clock
              className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"
              size={16}
            />
          </div>
          <span className="text-slate-400 font-bold">~</span>
          <div className="relative flex-1">
            <select
              value={data.defaultShiftEnd}
              onChange={(e) => onChange("defaultShiftEnd", e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-pink-500 focus:outline-none"
            >
              {timeOptions.map((t) => (
                <option key={`end-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Clock
              className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"
              size={16}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
