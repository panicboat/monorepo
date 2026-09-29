import { describe, expect, it } from "vitest";
import { hasKarteAccess } from "./useMyKarteAccess";

describe("hasKarteAccess", () => {
  it("is true for a cast with billing access on", () => {
    expect(hasKarteAccess("cast", { hasAccess: true, grantedAt: null })).toBe(true);
  });

  it("is false for a guest even with billing access on", () => {
    expect(hasKarteAccess("guest", { hasAccess: true, grantedAt: null })).toBe(false);
  });

  it("is false for a cast with billing access off", () => {
    expect(hasKarteAccess("cast", { hasAccess: false, grantedAt: null })).toBe(false);
  });

  it("is false when the role has not resolved yet", () => {
    expect(hasKarteAccess(null, { hasAccess: true, grantedAt: null })).toBe(false);
  });

  it("is false when the access data has not loaded yet", () => {
    expect(hasKarteAccess("cast", undefined)).toBe(false);
  });
});
