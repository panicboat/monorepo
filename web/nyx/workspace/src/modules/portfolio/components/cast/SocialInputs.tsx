"use client";

import { Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";

interface SocialInputsProps {
  data: ProfileFormData;
  onSocialChange: (
    key: keyof ProfileFormData["socialLinks"],
    value: string,
  ) => void;
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
            <Label className="block text-xs font-bold text-slate-500 mb-1">
              X (Twitter)
            </Label>
            <Input
              type="text"
              value={data.socialLinks?.x || ""}
              onChange={(e) => onSocialChange("x", e.target.value)}
              placeholder="@username"
              className="focus-visible:ring-pink-500"
            />
          </div>
          <div>
            <Label className="block text-xs font-bold text-slate-500 mb-1">
              Instagram
            </Label>
            <Input
              type="text"
              value={data.socialLinks?.instagram || ""}
              onChange={(e) => onSocialChange("instagram", e.target.value)}
              placeholder="@username"
              className="focus-visible:ring-pink-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="block text-xs font-bold text-slate-500 mb-1">
              TikTok
            </Label>
            <Input
              type="text"
              value={data.socialLinks?.tiktok || ""}
              onChange={(e) => onSocialChange("tiktok", e.target.value)}
              placeholder="@username"
              className="focus-visible:ring-pink-500"
            />
          </div>
          <div>
            <Label className="block text-xs font-bold text-slate-500 mb-1">
              CityHeaven
            </Label>
            <Input
              type="text"
              value={data.socialLinks?.cityheaven || ""}
              onChange={(e) => onSocialChange("cityheaven", e.target.value)}
              placeholder="https://..."
              className="focus-visible:ring-pink-500"
            />
          </div>
        </div>

        {/* LitLink */}
        <div>
          <Label className="block text-xs font-bold text-slate-500 mb-1">
            lit.link
          </Label>
          <Input
            type="text"
            value={data.socialLinks?.litlink || ""}
            onChange={(e) => onSocialChange("litlink", e.target.value)}
            placeholder="username"
            className="focus-visible:ring-pink-500"
          />
        </div>

        <div className="space-y-3 pt-2">
          {data.socialLinks.others?.map((url, idx) => (
            <div
              key={idx}
              className="flex gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="flex-1">
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => onOtherChange(idx, e.target.value)}
                  placeholder="https://... (Other Account)"
                  className="focus-visible:ring-pink-500"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveOther(idx)}
              >
                ✕
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            onClick={onAddOther}
            className="text-xs font-bold text-pink-500 hover:text-pink-600 flex items-center gap-1 hover:bg-pink-50"
          >
            + Add another account
          </Button>
        </div>
      </div>
    </section>
  );
};
