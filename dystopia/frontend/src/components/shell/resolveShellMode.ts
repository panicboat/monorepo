export type ShellMode = "bare" | "loading" | "landing" | "shell";

interface ResolveShellModeArgs {
  isHydrated: boolean;
  isAuthenticated: boolean;
  hasActiveProfile: boolean;
  isAuthRoute: boolean;
  isLandingRoute: boolean;
}

// Keep auth routes bare to avoid remounting authenticated onboarding forms.
export function resolveShellMode({
  isHydrated,
  isAuthenticated,
  hasActiveProfile,
  isAuthRoute,
  isLandingRoute,
}: ResolveShellModeArgs): ShellMode {
  if (isAuthRoute) return "bare";
  if (!isHydrated) return "loading";
  if (!isAuthenticated) return isLandingRoute ? "landing" : "loading";
  if (!hasActiveProfile) return "loading";
  return "shell";
}
