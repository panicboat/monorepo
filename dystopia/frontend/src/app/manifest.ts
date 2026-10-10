import type { MetadataRoute } from "next";
import { PWA_BACKGROUND_COLOR, PWA_ICON_VARIANTS } from "@/lib/pwa/icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "dystopia.city",
    short_name: "dystopia",
    description: "The Ritual of Sovereign Love",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_BACKGROUND_COLOR,
    icons: Object.entries(PWA_ICON_VARIANTS).map(([variant, { size, purpose }]) => ({
      src: `/pwa-icon/${variant}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose,
    })),
  };
}
