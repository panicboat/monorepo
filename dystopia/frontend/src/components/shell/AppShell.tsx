"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// A switch re-creates the navigation, so a double click would land on the profile just left and switch straight back.
const SWITCH_GUARD_MS = 800;

// Keep one object: a new config value on every render makes every SWR hook below re-render.
const PROFILE_CACHE_CONFIG = { provider: () => new Map() };

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isHydrated = useAuthStore(selectIsHydrated);
  const accountId = useAuthStore(selectAccountId);
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const deniedProfileId = useAuthStore(selectDeniedProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);
  const { session, profiles, hasListError, retry, refresh, append } = useProfileSession();
  const { signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pathSwitchedAwayFrom, setPathSwitchedAwayFrom] = useState<string | null>(null);
  const lastSwitchAt = useRef(0);
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
      if (Date.now() - lastSwitchAt.current < SWITCH_GUARD_MS) return;
      lastSwitchAt.current = Date.now();
      // Hold the page back until the top is reached: mounted as the next profile it would mark footprints read or leave a visit as that profile.
      if (pathname !== "/") setPathSwitchedAwayFrom(pathname);
      setActiveProfile(profileId);
      setDrawerOpen(false);
      router.replace("/");
    },
    [setActiveProfile, router, pathname]
  );
  const accountProfiles = useMemo(
    () => ({ profiles, switchProfile, refresh, append }),
    [profiles, switchProfile, refresh, append]
  );

  useEffect(() => {
    if (pathSwitchedAwayFrom !== null && pathSwitchedAwayFrom !== pathname) setPathSwitchedAwayFrom(null);
  }, [pathSwitchedAwayFrom, pathname]);

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
    <SWRConfig key={activeProfileId} value={PROFILE_CACHE_CONFIG}>
      <AccountProfilesProvider value={accountProfiles}>
        <div className="flex min-h-dvh flex-col bg-bg [touch-action:pan-y_pinch-zoom]">
          <div className="md:hidden">
            <TopBar onAvatarClick={() => setDrawerOpen(true)} />
          </div>
          <div className="mx-auto flex w-full max-w-screen-xl flex-1">
            <SideNav />
            <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
              {pathSwitchedAwayFrom === pathname ? null : children}
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
