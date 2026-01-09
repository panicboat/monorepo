"use client";

import { Home, Search, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { BottomNavBar, BottomNavTab } from "../BottomNavBar";

export const GuestBottomNavBar = () => {
  const { user, isLoading } = useAuth();

  // Hide during loading or if not logged in
  if (isLoading || !user) return null;

  const tabs: BottomNavTab[] = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "search", label: "Search", icon: Search, href: "/search" },
    {
      id: "concierge",
      label: "Concierge",
      icon: MessageCircle,
      href: "/concierge",
      badge: 2,
    }, // keeping badge logic static as prior code, or dynamic from state if available
    { id: "mypage", label: "My Page", icon: User, href: "/mypage" },
  ];

  return (
    <BottomNavBar
      tabs={tabs}
      layoutId="guest-nav-indicator"
      activeColorClass="text-pink-500"
    />
  );
};
