import { describe, expect, it } from "vitest";
import { resolveShellRedirect } from "./resolveShellRedirect";

const base = {
  isHydrated: true,
  isAuthenticated: true,
  sessionKind: "active" as const,
  isAuthRoute: false,
  isOnboardingRoute: false,
  isLandingRoute: false,
};

describe("resolveShellRedirect", () => {
  it("does nothing before hydration", () => {
    expect(resolveShellRedirect({ ...base, isHydrated: false, isAuthenticated: false, sessionKind: null })).toBeNull();
  });

  it("sends a signed-out visitor on a protected route to the login page", () => {
    expect(resolveShellRedirect({ ...base, isAuthenticated: false, sessionKind: null })).toBe("/login");
  });

  it("leaves a signed-out visitor on the landing route", () => {
    expect(resolveShellRedirect({ ...base, isAuthenticated: false, sessionKind: null, isLandingRoute: true })).toBeNull();
  });

  it("leaves visitors on the login and signup routes alone", () => {
    expect(resolveShellRedirect({ ...base, isAuthRoute: true })).toBeNull();
    expect(resolveShellRedirect({ ...base, isAuthRoute: true, isAuthenticated: false, sessionKind: null })).toBeNull();
  });

  it("sends an account with no enabled profile to onboarding", () => {
    expect(resolveShellRedirect({ ...base, sessionKind: "onboarding" })).toBe("/onboarding");
    expect(resolveShellRedirect({ ...base, sessionKind: "onboarding", isLandingRoute: true })).toBe("/onboarding");
  });

  it("keeps an account with no enabled profile on the onboarding route", () => {
    expect(
      resolveShellRedirect({ ...base, sessionKind: "onboarding", isAuthRoute: true, isOnboardingRoute: true })
    ).toBeNull();
  });

  it("moves an account that already has a profile away from the onboarding route", () => {
    expect(resolveShellRedirect({ ...base, sessionKind: "active", isAuthRoute: true, isOnboardingRoute: true })).toBe("/");
    expect(resolveShellRedirect({ ...base, sessionKind: "select", isAuthRoute: true, isOnboardingRoute: true })).toBe("/");
  });

  it("waits on the onboarding route while the profile list is still loading", () => {
    expect(resolveShellRedirect({ ...base, sessionKind: null, isAuthRoute: true, isOnboardingRoute: true })).toBeNull();
  });

  it("does nothing for an account with an active profile elsewhere", () => {
    expect(resolveShellRedirect(base)).toBeNull();
    expect(resolveShellRedirect({ ...base, sessionKind: "select" })).toBeNull();
    expect(resolveShellRedirect({ ...base, sessionKind: null })).toBeNull();
  });
});
