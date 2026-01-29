"use client";

import { Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { AreaSelector } from "./AreaSelector";

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
          <Label className="block text-sm font-bold text-slate-700 mb-1">
            Nickname (源氏名)
          </Label>
          <Input
            type="text"
            value={data.nickname}
            onChange={(e) => onChange("nickname", e.target.value)}
            placeholder="例: ユナ"
            className="focus-visible:ring-pink-500"
          />
        </div>

        <div>
          <Label className="block text-sm font-bold text-slate-700 mb-1">
            Handle (ID)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
            <Input
              type="text"
              value={data.handle || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                onChange("handle", val);
              }}
              placeholder="例: yuna123"
              className="pl-8 focus-visible:ring-pink-500"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            英数字のみ、3〜30文字。プロフィールURLに使用されます。
          </p>
        </div>

        <div>
          <Label className="block text-sm font-bold text-slate-700 mb-1">
            Area (活動エリア)
          </Label>
          <AreaSelector
            selectedIds={data.areaIds || []}
            onChange={(ids) => onChange("areaIds", ids)}
            maxSelections={3}
          />
        </div>

        <div>
          <Label className="block text-sm font-bold text-slate-700 mb-1">
            Tagline (キャッチコピー)
          </Label>
          <Input
            type="text"
            value={data.tagline}
            onChange={(e) => onChange("tagline", e.target.value)}
            placeholder="例: 癒やしの時間をお届けします✨"
            className="focus-visible:ring-pink-500"
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">
            {data.tagline.length}/30
          </p>
        </div>

        <div>
          <Label className="block text-sm font-bold text-slate-700 mb-1">
            Bio (自己紹介)
          </Label>
          <Textarea
            value={data.bio}
            onChange={(e) => onChange("bio", e.target.value)}
            placeholder="得意なこと、性格、趣味などを詳しく書いてみましょう..."
            rows={4}
            className="focus-visible:ring-pink-500 resize-none"
          />
        </div>
      </div>
    </section>
  );
};
