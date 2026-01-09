"use client";

import { Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";

interface ProfileInputsProps {
  data: ProfileFormData;
  onChange: (key: keyof ProfileFormData, value: any) => void;
}

export const ProfileInputs = ({ data, onChange }: ProfileInputsProps) => {
  return (
    <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2">
        <Info size={14} /> Basic Identity
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Nickname (源氏名)
          </label>
          <input
            type="text"
            value={data.nickname}
            onChange={(e) => onChange("nickname", e.target.value)}
            placeholder="例: ユナ"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Area (活動エリア)
          </label>
          <input
            type="text"
            value={data.area}
            onChange={(e) => onChange("area", e.target.value)}
            placeholder="例: 六本木, 西麻布"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Tagline (キャッチコピー)
          </label>
          <input
            type="text"
            value={data.tagline}
            onChange={(e) => onChange("tagline", e.target.value)}
            placeholder="例: 癒やしの時間をお届けします✨"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">
            {data.tagline.length}/30
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Bio (自己紹介)
          </label>
          <textarea
            value={data.bio}
            onChange={(e) => onChange("bio", e.target.value)}
            placeholder="得意なこと、性格、趣味などを詳しく書いてみましょう..."
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none"
          />
        </div>
      </div>
    </section>
  );
};
