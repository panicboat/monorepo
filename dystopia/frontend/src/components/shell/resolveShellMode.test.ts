import { describe, expect, it } from "vitest";
import { resolveShellMode } from "./resolveShellMode";

describe("resolveShellMode", () => {
  it("stays bare for an auth route once hydrated with a viewer already set", () => {
    // Regression test for #1235: an authenticated viewer on /onboarding must not remount into the full shell.
    expect(
      resolveShellMode({ isHydrated: true, viewerId: "u1", isAuthRoute: true, isLandingRoute: false })
    ).toBe("bare");
  });

  it("stays bare for an auth route before hydration", () => {
    expect(
      resolveShellMode({ isHydrated: false, viewerId: null, isAuthRoute: true, isLandingRoute: false })
    ).toBe("bare");
  });

  it("stays bare for an auth route once hydrated with no viewer", () => {
    expect(
      resolveShellMode({ isHydrated: true, viewerId: null, isAuthRoute: true, isLandingRoute: false })
    ).toBe("bare");
  });

  it("stays bare for an auth route before hydration even with a viewer already set", () => {
    expect(
      resolveShellMode({ isHydrated: false, viewerId: "u1", isAuthRoute: true, isLandingRoute: false })
    ).toBe("bare");
  });

  it("renders nothing before hydration on a non-auth route", () => {
    expect(
      resolveShellMode({ isHydrated: false, viewerId: null, isAuthRoute: false, isLandingRoute: false })
    ).toBe("loading");
  });

  it("renders the landing page once hydrated with no viewer on the landing route", () => {
    expect(
      resolveShellMode({ isHydrated: true, viewerId: null, isAuthRoute: false, isLandingRoute: true })
    ).toBe("landing");
  });

  it("renders nothing once hydrated with no viewer on a non-landing, non-auth route", () => {
    expect(
      resolveShellMode({ isHydrated: true, viewerId: null, isAuthRoute: false, isLandingRoute: false })
    ).toBe("loading");
  });

  it("renders the full shell once hydrated with a viewer on a non-auth route", () => {
    expect(
      resolveShellMode({ isHydrated: true, viewerId: "u1", isAuthRoute: false, isLandingRoute: false })
    ).toBe("shell");
  });
});
