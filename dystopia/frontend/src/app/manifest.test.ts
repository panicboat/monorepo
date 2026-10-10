import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("opens the app standalone from the root", () => {
    expect(manifest()).toMatchObject({ name: "dystopia.city", start_url: "/", scope: "/", display: "standalone" });
  });

  it("offers a 192 and a 512 icon for any use and a maskable 512 icon", () => {
    expect(manifest().icons).toEqual([
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});
