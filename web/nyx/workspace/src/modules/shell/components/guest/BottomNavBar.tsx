"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MessageCircle, User, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/modules/identity/hooks/useAuth";

export const BottomNavBar = () => {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Hide during loading or if not logged in
  if (isLoading || !user) return null;

  const tabs = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "search", label: "Search", icon: Search, href: "/search" },
    { id: "concierge", label: "Concierge", icon: MessageCircle, href: "/concierge" },
    { id: "mypage", label: "My Page", icon: User, href: "/mypage" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-slate-100 bg-white/90 px-6 pb-safe pt-2 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-between">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? "text-pink-500" : "text-slate-400 hover:text-slate-600"
                }`}
            >
              <div className="relative">
                <tab.icon className={`h-6 w-6 ${isActive ? "fill-current" : ""}`} />
                {tab.id === "concierge" && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                    2
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-2 h-1 w-8 rounded-full bg-pink-500"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
