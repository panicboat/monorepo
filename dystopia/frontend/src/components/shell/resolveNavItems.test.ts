import { describe, expect, it } from "vitest";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";

const paths = (role: "cast" | "guest" | null) => resolveNavItems({ role }).map((item) => item.path);

describe("resolveNavItems", () => {
  it("orders the entries from home down to settings", () => {
    expect(paths(null)).toEqual([
      "/",
      "/search",
      "/notifications",
      "/messages",
      "/footprints",
      "/bookmarks",
      "/ranking",
      PROFILE_NAV_PATH,
      "/settings",
    ]);
  });

  it("places my karte above the profile and settings entries for a cast", () => {
    const result = paths("cast");

    expect(result.slice(-3)).toEqual(["/karte/my", PROFILE_NAV_PATH, "/settings"]);
    expect(result).not.toContain("/reviews/my");
  });

  it("places my reviews above the profile and settings entries for a guest", () => {
    const result = paths("guest");

    expect(result.slice(-3)).toEqual(["/reviews/my", PROFILE_NAV_PATH, "/settings"]);
    expect(result).not.toContain("/karte/my");
  });
});
