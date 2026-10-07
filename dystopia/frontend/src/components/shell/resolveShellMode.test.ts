import { describe, expect, it } from "vitest";
import { resolveShellMode } from "./resolveShellMode";

const base = { isHydrated: true, isAuthenticated: true, hasActiveProfile: true, isAuthRoute: false, isLandingRoute: false };

describe("resolveShellMode", () => {
  it("stays bare for an auth route in every identity state", () => {
    expect(resolveShellMode({ ...base, isAuthRoute: true })).toBe("bare");
    expect(resolveShellMode({ ...base, isAuthRoute: true, isHydrated: false })).toBe("bare");
    expect(resolveShellMode({ ...base, isAuthRoute: true, isAuthenticated: false, hasActiveProfile: false })).toBe("bare");
    expect(resolveShellMode({ ...base, isAuthRoute: true, hasActiveProfile: false })).toBe("bare");
  });

  it("renders nothing before hydration on a non-auth route", () => {
    expect(resolveShellMode({ ...base, isHydrated: false })).toBe("loading");
  });

  it("renders the landing page once hydrated with no account on the landing route", () => {
    expect(resolveShellMode({ ...base, isAuthenticated: false, hasActiveProfile: false, isLandingRoute: true })).toBe("landing");
  });

  it("renders nothing once hydrated with no account on a non-landing route", () => {
    expect(resolveShellMode({ ...base, isAuthenticated: false, hasActiveProfile: false })).toBe("loading");
  });

  it("renders nothing for an account whose acting profile is not resolved yet", () => {
    expect(resolveShellMode({ ...base, hasActiveProfile: false })).toBe("loading");
    expect(resolveShellMode({ ...base, hasActiveProfile: false, isLandingRoute: true })).toBe("loading");
  });

  it("renders the full shell with an account and an acting profile", () => {
    expect(resolveShellMode(base)).toBe("shell");
    expect(resolveShellMode({ ...base, isLandingRoute: true })).toBe("shell");
  });
});
