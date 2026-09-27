export type ShellMode = "bare" | "loading" | "landing" | "shell";

interface ResolveShellModeArgs {
  isHydrated: boolean;
  viewerId: string | null;
  isAuthRoute: boolean;
  isLandingRoute: boolean;
}

// Keep auth routes bare to avoid remounting authenticated onboarding forms.
export function resolveShellMode({
  isHydrated,
  viewerId,
  isAuthRoute,
  isLandingRoute,
}: ResolveShellModeArgs): ShellMode {
  if (isAuthRoute) return "bare";
  if (!isHydrated) return "loading";
  if (!viewerId) return isLandingRoute ? "landing" : "loading";
  return "shell";
}
