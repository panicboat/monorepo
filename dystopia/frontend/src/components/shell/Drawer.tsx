"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useProfile } from "@/modules/profile/hooks";
import { useSocialCounts } from "@/modules/social";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useFootprintsUnreadCount } from "@/modules/footprints";
import { useNotificationPreferences } from "@/modules/notifications/hooks";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { ProfileSwitcher } from "@/modules/profile/components/ProfileSwitcher";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { classifySwipeDirection, clampDrawerOffset, shouldToggleDrawer, type SwipeDirection } from "./drawerSwipe";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

// Lets overflow-x-auto rows (tag filters, oshi row) keep native horizontal scroll instead of triggering the open-swipe gesture.
function isWithinHorizontalScrollable(element: Element | null): boolean {
  let el: Element | null = element;
  while (el instanceof HTMLElement) {
    const overflowX = window.getComputedStyle(el).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function Drawer({ open, onClose, onOpen }: DrawerProps) {
  const { profile } = useProfile();
  const { followingCount, followersCount } = useSocialCounts(profile?.id);
  const { count: unread } = useUnreadCount();
  const { count: msgUnread } = useTotalUnread();
  const { count: footprintsUnread } = useFootprintsUnreadCount();
  const { preferences } = useNotificationPreferences();
  const footprintsBadgeEnabled = preferences?.footprintUnreadBadge !== false;
  const { hasAccess: karteAccess } = useMyKarteAccess();
  const role = useAuthStore(selectRole);
  // The bottom tab bar already carries home on the widths where this menu shows.
  const navItems = resolveNavItems({ karteAccess, isGuest: role === "guest" }).filter((item) => item.path !== "/");
  const asideRef = useRef<HTMLElement>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState<number | null>(null);
  const closeDragRef = useRef<{ startX: number; startY: number; direction: SwipeDirection } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Listens across the whole content area, not just the edge, because edge-only detection competed with iOS Safari's back-swipe gesture.
  useEffect(() => {
    if (open) return;

    let gesture: { startX: number; startY: number; direction: SwipeDirection; ignored: boolean } | null = null;

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse") return;
      if (window.matchMedia("(min-width: 768px)").matches) return;
      gesture = {
        startX: e.clientX,
        startY: e.clientY,
        direction: "pending",
        ignored: isWithinHorizontalScrollable(e.target as Element | null),
      };
    }

    function onPointerMove(e: PointerEvent) {
      if (!gesture || gesture.ignored) return;
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (gesture.direction === "pending") {
        gesture.direction = classifySwipeDirection(dx, dy);
        if (gesture.direction === "vertical") {
          gesture.ignored = true;
          return;
        }
      }
      if (gesture.direction !== "horizontal") return;
      const width = asideRef.current?.offsetWidth ?? 0;
      setDragOffsetPx(clampDrawerOffset(-width, dx, width));
    }

    function onPointerEnd(e: PointerEvent) {
      if (!gesture || gesture.ignored || gesture.direction !== "horizontal") {
        gesture = null;
        return;
      }
      const dx = e.clientX - gesture.startX;
      const width = asideRef.current?.offsetWidth ?? 0;
      if (shouldToggleDrawer(dx, width, false)) {
        onOpen();
      }
      setDragOffsetPx(null);
      gesture = null;
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [open, onOpen]);

  function handleCloseDragStart(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType === "mouse") return;
    closeDragRef.current = { startX: e.clientX, startY: e.clientY, direction: "pending" };
  }

  function handleCloseDragMove(e: ReactPointerEvent<HTMLElement>) {
    const gesture = closeDragRef.current;
    if (!gesture) return;
    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    if (gesture.direction === "pending") {
      gesture.direction = classifySwipeDirection(dx, dy);
      if (gesture.direction === "vertical") return;
    }
    if (gesture.direction !== "horizontal") return;
    const width = asideRef.current?.offsetWidth ?? 0;
    setDragOffsetPx(clampDrawerOffset(0, dx, width));
  }

  function handleCloseDragEnd(e: ReactPointerEvent<HTMLElement>) {
    const gesture = closeDragRef.current;
    closeDragRef.current = null;
    if (!gesture || gesture.direction !== "horizontal") return;
    const dx = e.clientX - gesture.startX;
    const width = asideRef.current?.offsetWidth ?? 0;
    if (shouldToggleDrawer(dx, width, true)) {
      onClose();
    }
    setDragOffsetPx(null);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={asideRef}
        className={`fixed left-0 top-0 z-50 flex h-full w-80 max-w-[80vw] flex-col bg-bg shadow-2xl [touch-action:pan-y_pinch-zoom] ${
          dragOffsetPx === null ? "transition-transform duration-300 ease-out" : ""
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={dragOffsetPx !== null ? { transform: `translateX(${dragOffsetPx}px)` } : undefined}
        onPointerDown={handleCloseDragStart}
        onPointerMove={handleCloseDragMove}
        onPointerUp={handleCloseDragEnd}
        onPointerCancel={handleCloseDragEnd}
        role="dialog"
        aria-label="メニュー"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="border-b border-border px-4 py-4">
          <Avatar
            src={profile?.avatarUrl || undefined}
            fallback={(profile?.displayName || "?").slice(0, 1)}
            size="lg"
            className="h-16 w-16 text-xl"
          />
          <p className="pt-2 font-bold text-text-primary">{profile?.displayName || "—"}</p>
          <p className="text-sm text-text-secondary">@{profile?.username || "—"}</p>
          <p className="flex gap-3 pt-1 text-xs text-text-secondary">
            <Link href={profile?.username ? `/u/${profile.username}/following` : "/profile"} onClick={onClose} className="hover:underline">
              <strong className="text-text-primary">{followingCount}</strong> フォロー中
            </Link>
            <Link href={profile?.username ? `/u/${profile.username}/followers` : "/profile"} onClick={onClose} className="hover:underline">
              <strong className="text-text-primary">{followersCount}</strong> フォロワー
            </Link>
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            const badgeCount =
              item.badgeKey === "unread" ? unread :
              item.badgeKey === "messaging_unread" ? msgUnread :
              item.badgeKey === "footprints_unread" ? (footprintsBadgeEnabled ? footprintsUnread : 0) :
              0;
            const showBadge = badgeCount > 0;
            // FALLBACK: Use /profile until the own profile has loaded.
            const href = item.path === PROFILE_NAV_PATH ? (profile?.username ? `/u/${profile.username}` : "/profile") : item.path;
            return (
              <Link
                key={item.path}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-text-primary hover:bg-bg-secondary"
              >
                <item.icon className="size-6 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <ProfileSwitcher />
      </aside>
    </>
  );
}
