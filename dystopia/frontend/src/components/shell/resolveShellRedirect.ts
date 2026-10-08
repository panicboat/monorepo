import type { ProfileSession } from "@/modules/profile/lib/session";

interface ResolveShellRedirectArgs {
  isHydrated: boolean;
  isAuthenticated: boolean;
  sessionKind: ProfileSession["kind"] | null;
  isAuthRoute: boolean;
  isOnboardingRoute: boolean;
  isLandingRoute: boolean;
}

// Onboarding creates a profile, so an account that already has one must not stay on that route.
export function resolveShellRedirect({
  isHydrated,
  isAuthenticated,
  sessionKind,
  isAuthRoute,
  isOnboardingRoute,
  isLandingRoute,
}: ResolveShellRedirectArgs): string | null {
  if (!isHydrated) return null;
  if (isOnboardingRoute) return sessionKind !== null && sessionKind !== "onboarding" ? "/" : null;
  if (isAuthRoute) return null;
  if (!isAuthenticated) return isLandingRoute ? null : "/login";
  return sessionKind === "onboarding" ? "/onboarding" : null;
}
