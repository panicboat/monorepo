"use client";

import { Home, Search, User } from "lucide-react";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { BottomNavBar, BottomNavTab } from "../BottomNavBar";

export const GuestBottomNavBar = () => {
  const { user, isLoading } = useAuth();

  // Hide during loading or if not logged in
  if (isLoading || !user) return null;

  const tabs: BottomNavTab[] = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "search", label: "Search", icon: Search, href: "/search" },
    { id: "mypage", label: "My Page", icon: User, href: "/mypage" },
  ];

  return (
    <BottomNavBar
      tabs={tabs}
      layoutId="guest-nav-indicator"
      activeColorClass="text-role-guest"
    />
  );
};
