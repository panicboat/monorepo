import { PWA_ICON_VARIANTS } from "@/lib/pwa/icons";
import { renderLogoIcon } from "@/lib/pwa/render-logo-icon";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const icon = Object.hasOwn(PWA_ICON_VARIANTS, variant) ? PWA_ICON_VARIANTS[variant] : undefined;
  if (!icon) return new Response(null, { status: 404 });

  return renderLogoIcon(icon.size, icon.logoScale);
}
