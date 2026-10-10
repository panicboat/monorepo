"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "./BrandMark";
import { ComposeLauncher } from "@/components/compose/ComposeLauncher";
import { useProfile } from "@/modules/profile/hooks";
import { useUnreadCount, useNotificationPreferences } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useFootprintsUnreadCount } from "@/modules/footprints";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { ProfileSwitcher } from "@/modules/profile/components/ProfileSwitcher";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";

export function SideNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { count: unread } = useUnreadCount();
  const { count: msgUnread } = useTotalUnread();
  const { count: footprintsUnread } = useFootprintsUnreadCount();
  const { preferences } = useNotificationPreferences();
  const { hasAccess: karteAccess } = useMyKarteAccess();
  const role = useAuthStore(selectRole);

  const footprintsBadgeEnabled = preferences?.footprintUnreadBadge !== false;
  // FALLBACK: Use /profile until the own profile has loaded.
  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col px-3 py-4 md:flex">
      <BrandMark className="px-4 pb-4 text-xl" />
      <nav className="flex-1 overflow-y-auto">
        {resolveNavItems({ karteAccess, isGuest: role === "guest" }).map((item) => {
          const href = item.path === PROFILE_NAV_PATH ? profileHref : item.path;
          const active = pathname === href;
          const badgeCount =
            item.badgeKey === "unread" ? unread :
            item.badgeKey === "messaging_unread" ? msgUnread :
            item.badgeKey === "footprints_unread" ? (footprintsBadgeEnabled ? footprintsUnread : 0) :
            0;
          return (
            <Link
              key={item.path}
              href={href}
              className={`relative flex items-center gap-3 rounded-full px-4 py-3 text-lg hover:bg-bg-secondary ${
                active ? "font-bold text-text-primary" : "text-text-secondary"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-6 shrink-0" strokeWidth={active ? 2.5 : 2} />
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

      <ComposeLauncher variant="sidebar" />

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

      <ProfileSwitcher />
    </aside>
  );
}
