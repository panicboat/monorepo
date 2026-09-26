"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, selectUserId, selectIsHydrated } from "@/stores/authStore";
import { TopBar } from "./TopBar";
import { BottomTab } from "./BottomTab";
import { ComposerFAB } from "./ComposerFAB";
import { Drawer } from "./Drawer";
import { SideNav } from "./SideNav";
import { SuggestedUsersPane } from "./SuggestedUsersPane";
import { FeatureTourModal } from "@/modules/onboarding/components/FeatureTourModal";
import { LandingPage } from "@/modules/landing/components/LandingPage";
import { resolveShellMode } from "./resolveShellMode";

const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/onboarding"];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // All hooks run unconditionally at the top (rules-of-hooks).
  const isHydrated = useAuthStore(selectIsHydrated);
  const viewerId = useAuthStore(selectUserId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isLandingRoute = pathname === "/";

  // Redirect unauthenticated users to /login after hydration, except on auth routes.
  useEffect(() => {
    if (isHydrated && !viewerId && !isAuthRoute && !isLandingRoute) {
      router.replace("/login");
    }
  }, [isHydrated, viewerId, isAuthRoute, isLandingRoute, router]);

  const mode = resolveShellMode({ isHydrated, viewerId, isAuthRoute, isLandingRoute });

  // See resolveShellMode: auth routes stay bare even once hydrated with a viewer set.
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
    <div className="flex min-h-dvh flex-col bg-bg">
      <div className="md:hidden">
        <TopBar onAvatarClick={() => setDrawerOpen(true)} />
      </div>
      {/* Desktop 3-col: persistent left nav + center column + おすすめユーザー pane (xl:). */}
      <div className="mx-auto flex w-full max-w-screen-xl flex-1">
        <SideNav />
        <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
          {children}
        </main>
        <SuggestedUsersPane />
      </div>
      <BottomTab />
      <ComposerFAB />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <FeatureTourModal />
    </div>
  );
}
