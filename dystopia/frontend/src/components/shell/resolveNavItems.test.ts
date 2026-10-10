import { describe, expect, it } from "vitest";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";

const paths = (context: { karteAccess: boolean; isGuest: boolean }) =>
  resolveNavItems(context).map((item) => item.path);

describe("resolveNavItems", () => {
  it("orders the entries from home down to settings", () => {
    expect(paths({ karteAccess: false, isGuest: false })).toEqual([
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

  it("places my karte above the profile and settings entries for a viewer with karte access", () => {
    const result = paths({ karteAccess: true, isGuest: false });

    expect(result.slice(-3)).toEqual(["/karte/my", PROFILE_NAV_PATH, "/settings"]);
    expect(result).not.toContain("/reviews/my");
  });

  it("places my reviews above the profile and settings entries for a guest viewer", () => {
    const result = paths({ karteAccess: false, isGuest: true });

    expect(result.slice(-3)).toEqual(["/reviews/my", PROFILE_NAV_PATH, "/settings"]);
    expect(result).not.toContain("/karte/my");
  });
});
