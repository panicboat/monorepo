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

  // Redirect unauthenticated users to /login after hydration, except on auth routes.
  useEffect(() => {
    if (isHydrated && !viewerId && !isAuthRoute) {
      router.replace("/login");
    }
  }, [isHydrated, viewerId, isAuthRoute, router]);

  // Before hydration: auth routes still render their SSR content (avoid a blank
  // flash on /login etc.); other routes wait to avoid flashing shell-less content.
  if (!isHydrated) {
    return isAuthRoute ? <>{children}</> : null;
  }

  // Hydrated but unauthenticated: auth routes render their own page; others wait for redirect.
  if (!viewerId) {
    return isAuthRoute ? <>{children}</> : null;
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="md:hidden">
        <TopBar onAvatarClick={() => setDrawerOpen(true)} />
      </div>
      {/* Desktop 3-col: persistent left nav + center column + おすすめユーザー pane (xl:). */}
      <div className="mx-auto flex w-full max-w-screen-xl">
        <SideNav />
        <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
          {children}
        </main>
        <SuggestedUsersPane />
      </div>
      <BottomTab />
      <ComposerFAB />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
