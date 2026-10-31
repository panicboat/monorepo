"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, type LucideIcon } from "lucide-react";
import { ScheduleComposeSheet } from "@/components/compose/ScheduleComposeSheet";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { FEATURE_ICONS } from "@/components/ui/feature-icons";

const TABS = [
  { id: "home", path: "/", label: "ホーム", icon: FEATURE_ICONS.home },
  { id: "search", path: "/search", label: "検索", icon: FEATURE_ICONS.search },
  { id: "notifications", path: "/notifications", label: "通知", icon: FEATURE_ICONS.notifications },
  { id: "messages", path: "/messages", label: "メッセージ", icon: FEATURE_ICONS.messages },
];

const KARTE_TAB = { id: "karte", path: "/karte/my", label: "カルテ", icon: FEATURE_ICONS.karte };
const REVIEWS_TAB = { id: "reviews", path: "/reviews/my", label: "クチコミ", icon: FEATURE_ICONS.reviews };

interface BottomTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
}

const SCHEDULE_TAB: BottomTabItem = { id: "schedule", label: "予定", icon: CalendarDays };

const tabClass = (active: boolean) =>
  `relative flex min-h-[61px] flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] ${
    active ? "text-accent" : "text-text-secondary hover:text-text-primary"
  }`;

export function BottomTab() {
  const pathname = usePathname();
  const { count: notifCount } = useUnreadCount();
  const { count: msgCount } = useTotalUnread();
  const role = useAuthStore(selectRole);

  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [scheduling, setScheduling] = useState<{ session: number; open: boolean } | null>(null);

  const [home, search, ...rest] = TABS;
  const tabs: BottomTabItem[] =
    role === "cast"
      ? [home, SCHEDULE_TAB, ...rest, KARTE_TAB]
      : [home, search, ...rest, ...(role === "guest" ? [REVIEWS_TAB] : [])];

  return (
    <>
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-divider bg-bg px-1 md:hidden">
      {tabs.map((tab) => {
        if (!tab.path) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScheduling((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
              className={tabClass(false)}
            >
              <tab.icon className="size-[23px]" strokeWidth={2} />
              <span>{tab.label}</span>
            </button>
          );
        }
        const active = pathname === tab.path;
        const badgeCount =
          tab.id === "notifications" ? notifCount : tab.id === "messages" ? msgCount : 0;
        return (
          <Link
            key={tab.id}
            href={tab.path}
            onClick={(e) => {
              if (tab.id === "home" && active) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className={tabClass(active)}
            aria-current={active ? "page" : undefined}
          >
            <tab.icon className="size-[23px]" strokeWidth={active ? 2.5 : 2} />
            <span>{tab.label}</span>
            {badgeCount > 0 && (
              <span className="absolute right-2 top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
      {scheduling && (
        <ScheduleComposeSheet
          key={scheduling.session}
          open={scheduling.open}
          onClose={() => setScheduling((current) => current && { ...current, open: false })}
        />
      )}
    </>
  );
}
