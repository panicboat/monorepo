import type { ProfileSession } from "@/modules/profile/lib/session";

export type ShellMode = "bare" | "loading" | "landing" | "shell" | "profile-gate";

interface ResolveShellModeArgs {
  isHydrated: boolean;
  isAuthenticated: boolean;
  hasActiveProfile: boolean;
  sessionKind: ProfileSession["kind"] | null;
  hasProfileListError: boolean;
  isAuthRoute: boolean;
  isOnboardingRoute: boolean;
  isLandingRoute: boolean;
}

export function resolveShellMode(args: ResolveShellModeArgs): ShellMode {
  const {
    isHydrated,
    isAuthenticated,
    hasActiveProfile,
    sessionKind,
    hasProfileListError,
    isAuthRoute,
    isOnboardingRoute,
    isLandingRoute,
  } = args;
  if (isAuthRoute && !isOnboardingRoute) return "bare";
  if (!isHydrated) return "loading";
  if (!isAuthenticated) {
    if (isOnboardingRoute) return "bare";
    return isLandingRoute ? "landing" : "loading";
  }
  if (isOnboardingRoute) {
    if (sessionKind === "onboarding") return "bare";
    return hasProfileListError ? "profile-gate" : "loading";
  }
  if (hasActiveProfile) return "shell";
  if (hasProfileListError || sessionKind === "unavailable" || sessionKind === "select") return "profile-gate";
  return "loading";
}
