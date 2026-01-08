"use client";

import { useState } from "react";
import { ArrowRight, Info, Clock } from "lucide-react";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

export type ProfileFormData = {
  nickname: string;
  tagline: string;
  bio: string;
  serviceCategory: "advanced" | "standard" | "social";
  locationType: "store" | "dispatch" | "hotel";
  area: string;
  defaultShiftStart: string; // HH:mm
  defaultShiftEnd: string; // HH:mm
  socialLinks: {
    x?: string;
    instagram?: string;
    tiktok?: string;
    cityheaven?: string;
    litlink?: string;
    others: string[];
  };
};

// Simplified Select Component for MVP
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
        <span className="ml-2 text-xs font-normal text-slate-400">{description}</span>
      )}
    </label>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all ${value === opt.value
            ? "border-pink-500 bg-pink-50 text-pink-600 ring-1 ring-pink-500"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
        >
          <span className="text-sm font-bold">{opt.label}</span>
          {opt.desc && <span className="text-[10px] opacity-70">{opt.desc}</span>}
        </button>
      ))}
    </div>
  </div>
);

export const ProfileEditForm = ({
  initialData,
  onSubmit,
}: {
  initialData?: Partial<ProfileFormData>;
  onSubmit: (data: ProfileFormData) => void;
}) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    nickname: initialData?.nickname || "",
    tagline: initialData?.tagline || "",
    bio: initialData?.bio || "",
    serviceCategory: initialData?.serviceCategory || "standard",
    locationType: initialData?.locationType || "dispatch",
    area: initialData?.area || "",
    defaultShiftStart: initialData?.defaultShiftStart || "18:00",
    defaultShiftEnd: initialData?.defaultShiftEnd || "23:00",
    socialLinks: {
      others: [],
      ...initialData?.socialLinks,
    },
  });

  const handleChange = (key: keyof ProfileFormData, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSocialChange = (key: keyof ProfileFormData["socialLinks"], val: string) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [key]: val,
      },
    }));
  };

  // Dynamic Link Handlers
  const handleAddOther = () => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: [...(prev.socialLinks.others || []), ""],
      },
    }));
  };

  const handleRemoveOther = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: (prev.socialLinks.others || []).filter((_, i) => i !== index),
      },
    }));
  };

  const handleOtherChange = (index: number, val: string) => {
    setFormData((prev) => {
      const newOthers = [...(prev.socialLinks.others || [])];
      newOthers[index] = val;
      return {
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          others: newOthers,
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isFormValid =
    formData.nickname.trim().length > 0 &&
    formData.area.trim().length > 0 &&
    formData.tagline.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 2-Axis Business Type */}
      <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2">
          <Info size={14} /> Style Definition
        </h3>

        <SelectGroup
          label="1. Service Category"
          description="提供するサービスの内容"
          value={formData.serviceCategory}
          onChange={(val) => handleChange("serviceCategory", val)}
          options={[
            { label: "Advanced", value: "advanced", desc: "本番・濃厚接触" },
            { label: "Standard", value: "standard", desc: "擬似・ソフト" },
            { label: "Social", value: "social", desc: "接触なし・会話" },
          ]}
        />

        <SelectGroup
          label="2. Location Type"
          description="主な活動場所"
          value={formData.locationType}
          onChange={(val) => handleChange("locationType", val)}
          options={[
            { label: "Store", value: "store", desc: "店舗型" },
            { label: "Dispatch", value: "dispatch", desc: "派遣（デリバリー）" },
            { label: "Hotel", value: "hotel", desc: "ホテル待機" },
          ]}
        />

        {/* Default Schedule */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            3. Standard Shift Time
            <span className="ml-2 text-xs font-normal text-slate-400">基本の活動時間設定（デフォルト値になります）</span>
          </label>
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <select
                value={formData.defaultShiftStart}
                onChange={(e) => handleChange("defaultShiftStart", e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-pink-500 focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={`start-${t}`} value={t}>{t}</option>
                ))}
              </select>
              <Clock className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
            </div>
            <span className="text-slate-400 font-bold">~</span>
            <div className="relative flex-1">
              <select
                value={formData.defaultShiftEnd}
                onChange={(e) => handleChange("defaultShiftEnd", e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-pink-500 focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={`end-${t}`} value={t}>{t}</option>
                ))}
              </select>
              <Clock className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>
      </section>

      {/* Basic Info */}
      <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2">
          <Info size={14} /> Basic Identity
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nickname (源氏名)</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => handleChange("nickname", e.target.value)}
              placeholder="例: ユナ"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Area (活動エリア)</label>
            <input
              type="text"
              value={formData.area}
              onChange={(e) => handleChange("area", e.target.value)}
              placeholder="例: 六本木, 西麻布"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tagline (キャッチコピー)</label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => handleChange("tagline", e.target.value)}
              placeholder="例: 癒やしの時間をお届けします✨"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
            <p className="mt-1 text-right text-[10px] text-slate-400">{formData.tagline.length}/30</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Bio (自己紹介)</label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="得意なこと、性格、趣味などを詳しく書いてみましょう..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none"
            />
          </div>
        </div>
      </section>

      {/* External Links Section */}
      <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2">
          <Info size={14} /> Social & Links
        </h3>

        <div className="space-y-4">
          {/* Main Socials */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">X (Twitter)</label>
              <input
                type="text"
                value={formData.socialLinks?.x || ""}
                onChange={(e) => handleSocialChange("x", e.target.value)}
                placeholder="@username"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Instagram</label>
              <input
                type="text"
                value={formData.socialLinks?.instagram || ""}
                onChange={(e) => handleSocialChange("instagram", e.target.value)}
                placeholder="@username"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">TikTok</label>
              <input
                type="text"
                value={formData.socialLinks?.tiktok || ""}
                onChange={(e) => handleSocialChange("tiktok", e.target.value)}
                placeholder="@username"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">CityHeaven URL</label>
              <input
                type="text"
                value={formData.socialLinks?.cityheaven || ""}
                onChange={(e) => handleSocialChange("cityheaven", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          {/* LitLink & Dynamic Others */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">lit.link / Other Bio</label>
            <input
              type="text"
              value={formData.socialLinks?.litlink || ""}
              onChange={(e) => handleSocialChange("litlink", e.target.value)}
              placeholder="https://lit.link/..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
            />
          </div>

          <div className="space-y-3 pt-2">
            {formData.socialLinks.others?.map((url, idx) => (
              <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex-1">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => handleOtherChange(idx, e.target.value)}
                    placeholder="https://... (Other Account)"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveOther(idx)}
                  className="p-2 text-slate-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddOther}
              className="text-xs font-bold text-pink-500 hover:text-pink-600 flex items-center gap-1"
            >
              + Add another account
            </button>
          </div>
        </div>
      </section>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isFormValid}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 disabled:bg-slate-300 disabled:shadow-none"
      >
        <span>Next Step: Photos</span>
        <ArrowRight size={18} />
      </button>
    </form>
  );
};
