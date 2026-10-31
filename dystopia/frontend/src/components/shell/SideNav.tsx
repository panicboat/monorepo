"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "./BrandMark";
import { ComposeLauncher } from "@/components/compose/ComposeLauncher";
import { useProfile } from "@/modules/profile/hooks";
import { ProfileSwitcher } from "@/modules/profile/components/ProfileSwitcher";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";
import { useNavBadgeCount } from "./useNavBadgeCount";
import { cn } from "@/lib/utils";

export function SideNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const badgeCountOf = useNavBadgeCount();
  const role = useAuthStore(selectRole);

  // FALLBACK: Use /profile until the own profile has loaded.
  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";

  return (
    <aside className="sticky top-0 hidden h-screen w-[266px] shrink-0 flex-col border-r border-divider bg-bg px-4 py-[18px] md:flex">
      <BrandMark className="px-4 pb-3 text-lg" />
      <nav className="flex-1 overflow-y-auto">
        {resolveNavItems({ role }).map((item) => {
          const href = item.path === PROFILE_NAV_PATH ? profileHref : item.path;
          const active = pathname === href;
          const badgeCount = badgeCountOf(item.badgeKey);
          return (
            <Link
              key={item.path}
              href={href}
              className={cn(
                "relative flex h-[51px] items-center gap-4 rounded-[10px] px-4 text-base hover:bg-bg-secondary hover:text-text-primary",
                active ? "bg-bg-secondary text-text-primary" : "text-text-secondary"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className={cn("size-[22px] shrink-0", active && "text-accent")} strokeWidth={active ? 2.5 : 2} />
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
        className="mt-3 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg-secondary"
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
