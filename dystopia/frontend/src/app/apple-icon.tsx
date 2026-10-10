import { renderLogoIcon } from "@/lib/pwa/render-logo-icon";

export const runtime = "nodejs";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function Icon() {
  return renderLogoIcon(size.width);
}
