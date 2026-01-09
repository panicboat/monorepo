"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, MessageSquare, Menu } from "lucide-react";
import { BottomNavBar, BottomNavTab } from "../BottomNavBar";

export const CastBottomNavBar = () => {
  const pathname = usePathname();

  // Hide on onboarding wizard to prevent distraction?
  // For now, let's keep it consistent or hide it if strictly wizard.
  // Actually, usually onboarding hides nav.
  if (pathname.includes("/manage/onboarding")) return null;

  const tabs: BottomNavTab[] = [
    {
      id: "dashboard",
      label: "Home",
      icon: LayoutDashboard,
      href: "/manage/dashboard",
    },
    {
      id: "schedule",
      label: "Shift",
      icon: Calendar,
      href: "/manage/schedule",
    }, // Placeholder route
    { id: "inbox", label: "Inbox", icon: MessageSquare, href: "/manage/inbox" }, // Placeholder route
    { id: "menu", label: "Menu", icon: Menu, href: "/manage/menu" }, // Placeholder route
  ];

  return (
    <BottomNavBar
      tabs={tabs}
      layoutId="cast-nav-indicator"
      activeColorClass="text-slate-900"
    />
  );
};
