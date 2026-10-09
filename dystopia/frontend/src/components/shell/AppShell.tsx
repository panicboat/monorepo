"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SWRConfig } from "swr";
import {
  useAuthStore,
  selectAccountId,
  selectActiveProfileId,
  selectDeniedProfileId,
  selectIsHydrated,
} from "@/stores/authStore";
import { useProfileSession } from "@/modules/profile/hooks";
import { selectableProfiles } from "@/modules/profile/lib/session";
import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { ProfileGate } from "./ProfileGate";
import { ProfilePicker } from "./ProfilePicker";
import { TopBar } from "./TopBar";
import { BottomTab } from "./BottomTab";
import { ComposerFAB } from "./ComposerFAB";
import { Drawer } from "./Drawer";
import { SideNav } from "./SideNav";
import { SuggestedUsersPane } from "./SuggestedUsersPane";
import { FeatureTourModal } from "@/modules/onboarding/components/FeatureTourModal";
import { LandingPage } from "@/modules/landing/components/LandingPage";
import { resolveShellRedirect } from "./resolveShellRedirect";
import { resolveShellMode } from "./resolveShellMode";

const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/onboarding"];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isHydrated = useAuthStore(selectIsHydrated);
  const accountId = useAuthStore(selectAccountId);
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const deniedProfileId = useAuthStore(selectDeniedProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);
  const { session, profiles, hasListError, retry, refresh } = useProfileSession();
  const { signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isLandingRoute = pathname === "/";
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const redirectTo = resolveShellRedirect({
    isHydrated,
    isAuthenticated: !!accountId,
    sessionKind: session?.kind ?? null,
    isAuthRoute,
    isOnboardingRoute,
    isLandingRoute,
  });

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const switchProfile = useCallback(
    (profileId: string) => {
      setActiveProfile(profileId);
      setDrawerOpen(false);
      router.push("/");
    },
    [setActiveProfile, router]
  );
  const accountProfiles = useMemo(() => ({ profiles, switchProfile, refresh }), [profiles, switchProfile, refresh]);

  const mode = resolveShellMode({
    isHydrated,
    isAuthenticated: !!accountId,
    hasActiveProfile: !!activeProfileId,
    sessionKind: session?.kind ?? null,
    hasProfileListError: hasListError,
    isAuthRoute,
    isOnboardingRoute,
    isLandingRoute,
  });

  if (mode === "bare") {
    return <>{children}</>;
  }

  if (mode === "loading") {
    return null;
  }

  if (mode === "landing") {
    return <LandingPage />;
  }

  if (mode === "profile-gate") {
    if (hasListError) {
      return <ProfileGate reason="error" onRetry={retry} onSignOut={signOut} />;
    }
    if (session?.kind === "unavailable") {
      return <ProfileGate reason="unavailable" onRetry={retry} onSignOut={signOut} />;
    }
    return (
      <ProfilePicker
        profiles={selectableProfiles(profiles, deniedProfileId)}
        onSelect={setActiveProfile}
        onSignOut={signOut}
      />
    );
  }

  // Give each acting profile its own cache: keys carry no profile id, so a shared cache would show one profile's data to the next.
  return (
    <SWRConfig key={activeProfileId} value={{ provider: () => new Map() }}>
      <AccountProfilesProvider value={accountProfiles}>
        <div className="flex min-h-dvh flex-col bg-bg [touch-action:pan-y_pinch-zoom]">
          <div className="md:hidden">
            <TopBar onAvatarClick={() => setDrawerOpen(true)} />
          </div>
          <div className="mx-auto flex w-full max-w-screen-xl flex-1">
            <SideNav />
            <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
              {children}
            </main>
            <SuggestedUsersPane />
          </div>
          <BottomTab />
          <ComposerFAB />
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpen={() => setDrawerOpen(true)} />
          <FeatureTourModal />
        </div>
      </AccountProfilesProvider>
    </SWRConfig>
  );
}
