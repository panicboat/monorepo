"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "./BrandMark";
import { PostComposerModal } from "@/modules/post/components/PostComposerModal";
import { useProfile } from "@/modules/profile/hooks";
import { useUnreadCount, useNotificationPreferences } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useFootprintsUnreadCount } from "@/modules/footprints";

type BadgeKey = "unread" | "messaging_unread" | "footprints_unread";

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badgeKey?: BadgeKey;
}

// Desktop nav order mirrors the rx-sns 3-col reference (ホーム first, プロフィール
// near the bottom). The mobile Drawer keeps its own order, so the two lists are
// intentionally separate.
const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "ホーム", icon: "🏠" },
  { path: "/search", label: "検索", icon: "🔍" },
  { path: "/notifications", label: "通知", icon: "🔔", badgeKey: "unread" },
  { path: "/footprints", label: "足跡", icon: "👣", badgeKey: "footprints_unread" },
  { path: "/messages", label: "メッセージ", icon: "💬", badgeKey: "messaging_unread" },
  { path: "/bookmarks", label: "ブックマーク", icon: "🔖" },
  { path: "/oshi", label: "推し！", icon: "⭐" },
  { path: "/ranking", label: "ランキング", icon: "🏆" },
  { path: "__profile__", label: "プロフィール", icon: "👤" },
  { path: "/settings", label: "設定", icon: "⚙" },
];

export function SideNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { count: unread } = useUnreadCount();
  const { count: msgUnread } = useTotalUnread();
  const { count: footprintsUnread } = useFootprintsUnreadCount();
  const { preferences } = useNotificationPreferences();
  const [composerOpen, setComposerOpen] = useState(false);

  const footprintsBadgeEnabled = preferences?.footprintUnreadBadge !== false;
  const profileHref = profile?.username
    ? `/u/${encodeURIComponent(profile.username)}`
    : "/profile";

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col px-3 py-4 md:flex">
      <BrandMark className="px-4 pb-4 text-xl" />
      <nav className="flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const href = item.path === "__profile__" ? profileHref : item.path;
          const active = item.path === "__profile__" ? pathname === profileHref : pathname === item.path;
          const badgeCount =
            item.badgeKey === "unread" ? unread :
            item.badgeKey === "messaging_unread" ? msgUnread :
            item.badgeKey === "footprints_unread" ? (footprintsBadgeEnabled ? footprintsUnread : 0) :
            0;
          return (
            <Link
              key={item.path}
              href={href}
              className={`relative flex items-center gap-3 rounded-full px-4 py-3 text-base hover:bg-bg-secondary ${
                active ? "font-bold text-text-primary" : "text-text-secondary"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="mt-3 rounded-full bg-gradient-brand py-3 text-center font-bold text-white shadow-brand-glow active:scale-95"
      >
        投稿する
      </button>

      <Link
        href={profileHref}
        className="mt-3 flex items-center gap-3 rounded-full px-2 py-2 hover:bg-bg-secondary"
      >
        <Avatar
          src={profile?.avatarUrl || undefined}
          fallback={(profile?.displayName || "?").slice(0, 1)}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text-primary">{profile?.displayName || "—"}</p>
          <p className="truncate text-xs text-text-secondary">@{profile?.username || "—"}</p>
        </div>
      </Link>

      <PostComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} />
    </aside>
  );
}
