import { describe, expect, it } from "vitest";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";

const paths = (role: "cast" | "guest" | null) => resolveNavItems({ role }).map((item) => item.path);

describe("resolveNavItems", () => {
  it("orders the entries from home down to settings with the profile right after home", () => {
    expect(paths(null)).toEqual([
      "/",
      PROFILE_NAV_PATH,
      "/search",
      "/notifications",
      "/messages",
      "/footprints",
      "/bookmarks",
      "/ranking",
      "/settings",
    ]);
  });

  it("places my karte above the settings entry for a cast", () => {
    const result = paths("cast");

    expect(result.slice(-2)).toEqual(["/karte/my", "/settings"]);
    expect(result).not.toContain("/reviews/my");
  });

  it("places my reviews above the settings entry for a guest", () => {
    const result = paths("guest");

    expect(result.slice(-2)).toEqual(["/reviews/my", "/settings"]);
    expect(result).not.toContain("/karte/my");
  });
});
