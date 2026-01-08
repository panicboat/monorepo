"use client";

import { Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";

interface SocialInputsProps {
  data: ProfileFormData;
  onSocialChange: (key: keyof ProfileFormData["socialLinks"], value: string) => void;
  onOtherChange: (index: number, value: string) => void;
  onAddOther: () => void;
  onRemoveOther: (index: number) => void;
}

export const SocialInputs = ({
  data,
  onSocialChange,
  onOtherChange,
  onAddOther,
  onRemoveOther,
}: SocialInputsProps) => {
  return (
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
              value={data.socialLinks?.x || ""}
              onChange={(e) => onSocialChange("x", e.target.value)}
              placeholder="@username"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Instagram</label>
            <input
              type="text"
              value={data.socialLinks?.instagram || ""}
              onChange={(e) => onSocialChange("instagram", e.target.value)}
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
              value={data.socialLinks?.tiktok || ""}
              onChange={(e) => onSocialChange("tiktok", e.target.value)}
              placeholder="@username"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">CityHeaven URL</label>
            <input
              type="text"
              value={data.socialLinks?.cityheaven || ""}
              onChange={(e) => onSocialChange("cityheaven", e.target.value)}
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
            value={data.socialLinks?.litlink || ""}
            onChange={(e) => onSocialChange("litlink", e.target.value)}
            placeholder="https://lit.link/..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-pink-500 focus:outline-none"
          />
        </div>

        <div className="space-y-3 pt-2">
          {data.socialLinks.others?.map((url, idx) => (
            <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex-1">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => onOtherChange(idx, e.target.value)}
                  placeholder="https://... (Other Account)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveOther(idx)}
                className="p-2 text-slate-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddOther}
            className="text-xs font-bold text-pink-500 hover:text-pink-600 flex items-center gap-1"
          >
            + Add another account
          </button>
        </div>
      </div>
    </section>
  );
};
