"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

export type BottomNavTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number | string;
};

interface BottomNavBarProps {
  tabs: BottomNavTab[];
  layoutId?: string; // For framer-motion unique id between guest/cast
  activeColorClass?: string;
}

export const BottomNavBar = ({
  tabs,
  layoutId = "nav-indicator",
  activeColorClass = "text-pink-500",
}: BottomNavBarProps) => {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-slate-100 bg-white/90 px-6 pb-safe pt-2 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-between">
        {tabs.map((tab) => {
          // Active if exact match or starts with (except root)
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/" &&
              tab.href !== "/cast" &&
              pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                isActive
                  ? activeColorClass
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className="relative">
                <tab.icon
                  className={`h-6 w-6 ${isActive ? "fill-current" : ""}`}
                />
                {tab.badge && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className={`absolute -top-2 h-1 w-8 rounded-full ${activeColorClass.replace("text-", "bg-")}`}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
