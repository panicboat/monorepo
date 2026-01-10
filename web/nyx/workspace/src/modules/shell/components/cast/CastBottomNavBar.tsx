"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, MessageSquare, List } from "lucide-react";
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
      label: "Schedule",
      icon: Calendar,
      href: "/manage/schedule",
    },
    { id: "plans", label: "Plan", icon: List, href: "/manage/plans" },
    { id: "inbox", label: "Inbox", icon: MessageSquare, href: "/manage/inbox" },
  ];

  return (
    <BottomNavBar
      tabs={tabs}
      layoutId="cast-nav-indicator"
      activeColorClass="text-slate-900"
    />
  );
};
