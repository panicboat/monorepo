"use client";

import { useState } from "react";
import { useAuthStore, selectUserId, selectIsHydrated } from "@/stores/authStore";
import { TopBar } from "./TopBar";
import { BottomTab } from "./BottomTab";
import { ComposerFAB } from "./ComposerFAB";
import { Drawer } from "./Drawer";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isHydrated = useAuthStore(selectIsHydrated);
  const viewerId = useAuthStore(selectUserId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // hydration 前 or 未認証 = shell bypass
  if (!isHydrated || !viewerId) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopBar onAvatarClick={() => setDrawerOpen(true)} />
      <div className="flex-1 pb-24 md:pb-0">{children}</div>
      <BottomTab />
      <ComposerFAB />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
