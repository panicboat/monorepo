export interface PwaIconVariant {
  size: number;
  logoScale: number;
  purpose: "any" | "maskable";
}

// A launcher may crop a maskable icon to a circle 80% of its width, so that variant shrinks the logo until the rim of the glass fits inside.
export const PWA_ICON_VARIANTS: Record<string, PwaIconVariant> = {
  "192": { size: 192, logoScale: 1, purpose: "any" },
  "512": { size: 512, logoScale: 1, purpose: "any" },
  maskable: { size: 512, logoScale: 0.8, purpose: "maskable" },
};

export const PWA_BACKGROUND_COLOR = "#0f172a";

export const PWA_ICON_BACKGROUND = `linear-gradient(to bottom right, ${PWA_BACKGROUND_COLOR}, #1e1b4b)`;
