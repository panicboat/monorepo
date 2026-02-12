"use client";

import { User, LayoutList, Calendar } from "lucide-react";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { BottomNavBar, BottomNavTab } from "../BottomNavBar";

export const CastBottomNavBar = () => {
  const pathname = usePathname();

  // Hide on onboarding wizard
  if (pathname.includes("/cast/onboarding")) return null;

  const tabs: BottomNavTab[] = [
    {
      id: "home",
      label: "Home",
      icon: LayoutDashboard,
      href: "/cast/home",
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: LayoutList,
      href: "/cast/timeline",
    },
    {
      id: "schedules",
      label: "Schedules",
      icon: Calendar,
      href: "/cast/schedules",
    },
    {
      id: "mypage",
      label: "MyPage",
      icon: User,
      href: "/cast/mypage",
    },
  ];

  return (
    <BottomNavBar
      tabs={tabs}
      layoutId="cast-nav-indicator"
      activeColorClass="text-role-cast"
    />
  );
};
