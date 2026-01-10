"use client";

import { MessageCircle, Ticket } from "lucide-react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar } from "lucide-react";
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
    { id: "plans", label: "Plan", icon: Ticket, href: "/manage/plans" },
    {
      id: "concierge",
      label: "Concierge",
      icon: MessageCircle,
      href: "/manage/concierge",
      badge: 2,
    }, // keeping badge logic static as prior code, or dynamic from state if available
  ];

  return (
    <BottomNavBar
      tabs={tabs}
      layoutId="cast-nav-indicator"
      activeColorClass="text-pink-500"
    />
  );
};
