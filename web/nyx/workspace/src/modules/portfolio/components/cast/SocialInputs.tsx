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
    <section className="space-y-6 rounded-2xl bg-surface p-5 shadow-sm border border-border">
      <h3 className="flex items-center gap-2 text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border pb-2">
        <Info size={14} /> Social & Links
      </h3>

      <div className="space-y-4">
        {/* Main Socials */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="block text-xs font-bold text-text-secondary mb-1">
              X (Twitter)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">@</span>
              <Input
                type="text"
                value={data.socialLinks?.x || ""}
                onChange={(e) => onSocialChange("x", e.target.value)}
                placeholder="username"
                className="pl-8 focus-visible:ring-role-cast"
              />
            </div>
          </div>
          <div>
            <Label className="block text-xs font-bold text-text-secondary mb-1">
              Instagram
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">@</span>
              <Input
                type="text"
                value={data.socialLinks?.instagram || ""}
                onChange={(e) => onSocialChange("instagram", e.target.value)}
                placeholder="username"
                className="pl-8 focus-visible:ring-role-cast"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="block text-xs font-bold text-text-secondary mb-1">
              TikTok
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">@</span>
              <Input
                type="text"
                value={data.socialLinks?.tiktok || ""}
                onChange={(e) => onSocialChange("tiktok", e.target.value)}
                placeholder="username"
                className="pl-8 focus-visible:ring-role-cast"
              />
            </div>
          </div>
          <div>
            <Label className="block text-xs font-bold text-text-secondary mb-1">
              lit.link
            </Label>
            <Input
              type="text"
              value={data.socialLinks?.litlink || ""}
              onChange={(e) => onSocialChange("litlink", e.target.value)}
              placeholder="username"
              className="focus-visible:ring-role-cast"
            />
          </div>
        </div>

        {/* CityHeaven */}
        <div>
          <Label className="block text-xs font-bold text-text-secondary mb-1">
            CityHeaven
          </Label>
          <Input
            type="text"
            value={data.socialLinks?.cityheaven || ""}
            onChange={(e) => onSocialChange("cityheaven", e.target.value)}
            placeholder="https://..."
            className="focus-visible:ring-role-cast"
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
                  className="focus-visible:ring-role-cast"
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
            className="text-xs font-bold text-role-cast hover:text-role-cast-hover flex items-center gap-1 hover:bg-role-cast-lighter"
          >
            + Add another account
          </Button>
        </div>
      </div>
    </section>
  );
};
