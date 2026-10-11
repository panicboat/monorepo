import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { PWA_ICON_BACKGROUND } from "./icons";

export function renderLogoIcon(size: number, logoScale = 1): ImageResponse {
  const svg = readFileSync(join(process.cwd(), "public/logo.svg"));
  const logoSize = `${logoScale * 100}%`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PWA_ICON_BACKGROUND,
      }}
    >
      <img
        alt=""
        src={`data:image/svg+xml;base64,${svg.toString("base64")}`}
        style={{ width: logoSize, height: logoSize }}
      />
    </div>,
    { width: size, height: size },
  );
}
