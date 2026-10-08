"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, selectAccountId, selectActiveProfileId, selectIsHydrated } from "@/stores/authStore";
import { useProfileSession } from "@/modules/profile/hooks";
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
  const session = useProfileSession();
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

  // TODO: Render a profile picker when the session kind is "select"; the shell stays blank until then.
  const mode = resolveShellMode({
    isHydrated,
    isAuthenticated: !!accountId,
    hasActiveProfile: !!activeProfileId,
    isAuthRoute,
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

  return (
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
  );
}
