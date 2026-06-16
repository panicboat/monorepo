"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/modules/notifications/hooks";

const TABS = [
  { id: "home", path: "/", label: "ホーム", icon: "🏠" },
  { id: "search", path: "/search", label: "検索", icon: "🔍" },
  { id: "notifications", path: "/notifications", label: "通知", icon: "🔔" },
  { id: "messages", path: "/messages", label: "メッセージ", icon: "💬" },
];

export function BottomTab() {
  const pathname = usePathname();
  const { count } = useUnreadCount();

  return (
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border bg-bg/95 px-2 py-1 backdrop-blur md:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        const isNotif = tab.id === "notifications";
        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-xs ${
              active ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="text-xl" aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
            {isNotif && count > 0 && (
              <span className="absolute right-2 top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-[10px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
