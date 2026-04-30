"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const socialButtonVariants = cva(
  "px-3 py-1 rounded-full text-xs font-medium transition inline-block",
  {
    variants: {
      platform: {
        x: "bg-neutral-900 text-text-inverted hover:bg-neutral-800",
        instagram:
          "bg-gradient-to-r from-purple-500 to-pink-500 text-text-inverted hover:opacity-90",
        tiktok: "bg-neutral-900 text-text-inverted hover:bg-neutral-800",
        litlink: "bg-info text-text-inverted hover:bg-info-hover",
        cityheaven: "bg-role-cast text-text-inverted hover:bg-role-cast-hover",
        default: "bg-surface-secondary text-text-secondary hover:bg-neutral-200",
      },
    },
    defaultVariants: {
      platform: "default",
    },
  }
);

type SocialPlatform = "x" | "instagram" | "tiktok" | "litlink" | "cityheaven" | "default";

const platformUrls: Record<SocialPlatform, (handle: string) => string> = {
  x: (handle) => `https://x.com/${handle}`,
  instagram: (handle) => `https://instagram.com/${handle}`,
  tiktok: (handle) => `https://tiktok.com/@${handle}`,
  litlink: (handle) => `https://lit.link/${handle}`,
  cityheaven: (handle) => handle, // Full URL expected
  default: (handle) => handle,
};

const platformLabels: Record<SocialPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  litlink: "lit.link",
  cityheaven: "CityHeaven",
  default: "Link",
};

type SocialButtonProps = {
  platform: SocialPlatform;
  handle: string;
  label?: string;
  className?: string;
} & VariantProps<typeof socialButtonVariants>;

export function SocialButton({
  platform,
  handle,
  label,
  className,
}: SocialButtonProps) {
  const url = platformUrls[platform](handle);
  const displayLabel = label || platformLabels[platform];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(socialButtonVariants({ platform }), className)}
    >
      {displayLabel}
    </a>
  );
}
