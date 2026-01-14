"use client";

import { MessageCircle, Ticket, User, LayoutList } from "lucide-react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar } from "lucide-react";
import { BottomNavBar, BottomNavTab } from "../BottomNavBar";

export const CastBottomNavBar = () => {
  const pathname = usePathname();

  // Hide on onboarding wizard to prevent distraction?
  // For now, let's keep it consistent or hide it if strictly wizard.
  // Actually, usually onboarding hides nav.
  if (pathname.includes("/cast/onboarding")) return null;

  const tabs: BottomNavTab[] = [
    {
      id: "home",
      label: "Home",
      icon: LayoutDashboard,
      href: "/cast/home",
    },
    {
      id: "schedule",
      label: "Schedule",
      icon: Calendar,
      href: "/cast/schedule",
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: LayoutList,
      href: "/cast/timeline",
    },
    {
      id: "concierge",
      label: "Concierge",
      icon: MessageCircle,
      href: "/cast/concierge",
      badge: 2,
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
      activeColorClass="text-pink-500"
    />
  );
};
