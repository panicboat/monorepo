"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { FEATURE_ICONS } from "@/components/ui/feature-icons";

const TABS = [
  { id: "home", path: "/", label: "ホーム", icon: FEATURE_ICONS.home },
  { id: "search", path: "/search", label: "検索", icon: FEATURE_ICONS.search },
  { id: "notifications", path: "/notifications", label: "通知", icon: FEATURE_ICONS.notifications },
  { id: "messages", path: "/messages", label: "メッセージ", icon: FEATURE_ICONS.messages },
];

const KARTE_TAB = { id: "karte", path: "/karte/my", label: "カルテ", icon: FEATURE_ICONS.karte };
const REVIEWS_TAB = { id: "reviews", path: "/reviews/my", label: "レビュー", icon: FEATURE_ICONS.reviews };

export function BottomTab() {
  const pathname = usePathname();
  const { count: notifCount } = useUnreadCount();
  const { count: msgCount } = useTotalUnread();
  const { hasAccess: karteAccess } = useMyKarteAccess();
  const role = useAuthStore(selectRole);

  const tabs = [
    ...TABS,
    ...(karteAccess ? [KARTE_TAB] : []),
    ...(role === "guest" ? [REVIEWS_TAB] : []),
  ];

  return (
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border bg-bg/95 px-2 py-1 backdrop-blur md:hidden">
      {tabs.map((tab) => {
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
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-sm ${
              active ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <tab.icon className="size-6" strokeWidth={active ? 2.5 : 2} />
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
  );
}
