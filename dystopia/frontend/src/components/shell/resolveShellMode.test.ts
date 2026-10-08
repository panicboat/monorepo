import { describe, expect, it } from "vitest";
import { resolveShellMode } from "./resolveShellMode";

const base = {
  isHydrated: true,
  isAuthenticated: true,
  hasActiveProfile: true,
  sessionKind: "active" as const,
  hasProfileListError: false,
  isAuthRoute: false,
  isOnboardingRoute: false,
  isLandingRoute: false,
};

describe("resolveShellMode", () => {
  it("keeps auth routes other than onboarding bare in every identity state", () => {
    const states = [
      { isHydrated: false, isAuthenticated: false, hasActiveProfile: false },
      { isHydrated: true, isAuthenticated: false, hasActiveProfile: false },
      { isHydrated: true, isAuthenticated: true, hasActiveProfile: false },
      { isHydrated: true, isAuthenticated: true, hasActiveProfile: true },
    ];

    for (const state of states) {
      expect(
        resolveShellMode({ ...base, ...state, isAuthRoute: true, isOnboardingRoute: false })
      ).toBe("bare");
    }
  });

  it("waits for hydration before showing onboarding", () => {
    expect(
      resolveShellMode({
        ...base,
        isHydrated: false,
        isAuthenticated: true,
        hasActiveProfile: false,
        sessionKind: null,
        isAuthRoute: true,
        isOnboardingRoute: true,
      })
    ).toBe("loading");
  });

  it("shows onboarding to a signed-out visitor", () => {
    expect(
      resolveShellMode({
        ...base,
        isAuthenticated: false,
        hasActiveProfile: false,
        sessionKind: null,
        isAuthRoute: true,
        isOnboardingRoute: true,
      })
    ).toBe("bare");
  });

  it("shows onboarding to an authenticated account with no enabled profile", () => {
    expect(
      resolveShellMode({
        ...base,
        hasActiveProfile: false,
        sessionKind: "onboarding",
        isAuthRoute: true,
        isOnboardingRoute: true,
      })
    ).toBe("bare");
  });

  it("waits on onboarding until the authenticated session resolves as onboarding", () => {
    for (const sessionKind of [null, "active", "select", "unavailable"] as const) {
      expect(
        resolveShellMode({
          ...base,
          hasActiveProfile: false,
          sessionKind,
          isAuthRoute: true,
          isOnboardingRoute: true,
        })
      ).toBe("loading");
    }
  });

  it("shows the profile gate when the profile list failed on onboarding", () => {
    expect(
      resolveShellMode({
        ...base,
        hasActiveProfile: false,
        sessionKind: null,
        hasProfileListError: true,
        isAuthRoute: true,
        isOnboardingRoute: true,
      })
    ).toBe("profile-gate");
  });

  it("renders the shell when a profile is active even if the list failed", () => {
    expect(resolveShellMode({ ...base, hasProfileListError: true })).toBe("shell");
  });

  it("shows the profile gate for list errors and resolved blocked sessions", () => {
    expect(resolveShellMode({ ...base, hasActiveProfile: false, sessionKind: null, hasProfileListError: true })).toBe("profile-gate");
    expect(resolveShellMode({ ...base, hasActiveProfile: false, sessionKind: "unavailable" })).toBe("profile-gate");
    expect(resolveShellMode({ ...base, hasActiveProfile: false, sessionKind: "select" })).toBe("profile-gate");
  });

  it("waits while the acting profile is unresolved", () => {
    expect(resolveShellMode({ ...base, hasActiveProfile: false, sessionKind: null })).toBe("loading");
  });

  it("renders the landing page for a signed-out visitor", () => {
    expect(
      resolveShellMode({
        ...base,
        isAuthenticated: false,
        hasActiveProfile: false,
        sessionKind: null,
        isLandingRoute: true,
      })
    ).toBe("landing");
  });
});
