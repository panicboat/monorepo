import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Function to allow reading file in Node.js runtime
export const runtime = "nodejs";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function Icon() {
  const svgPath = join(process.cwd(), "public/logo.svg");
  const svg = readFileSync(svgPath);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      {/* Render SVG as an image */}
      <img
        src={`data:image/svg+xml;base64,${svg.toString("base64")}`}
        style={{ width: "100%", height: "100%" }}
      />
    </div>,
    {
      ...size,
    },
  );
}
