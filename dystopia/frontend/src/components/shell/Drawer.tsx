"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/modules/profile/hooks";
import { useSocialCounts } from "@/modules/social";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useTotalUnread } from "@/modules/messaging";
import { useFootprintsUnreadCount } from "@/modules/footprints";
import { useNotificationPreferences } from "@/modules/notifications/hooks";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { classifySwipeDirection, clampDrawerOffset, shouldToggleDrawer, type SwipeDirection } from "./drawerSwipe";

const NAV_ITEMS = [
  { path: "__profile__", label: "プロフィール", icon: "👤" },
  { path: "/search", label: "検索", icon: "🔍" },
  { path: "/notifications", label: "通知", icon: "🔔", badgeKey: "unread" as const },
  { path: "/footprints", label: "足跡", icon: "👣", badgeKey: "footprints_unread" as const },
  { path: "/messages", label: "メッセージ", icon: "💬", badgeKey: "messaging_unread" as const },
  { path: "/bookmarks", label: "ブックマーク", icon: "🔖" },
  { path: "/ranking", label: "ランキング", icon: "🏆" },
  { path: "/settings", label: "設定", icon: "⚙" },
];

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
  const { logout } = useAuth();
  const { profile } = useProfile();
  const { followingCount, followersCount } = useSocialCounts(profile?.accountId);
  const { count: unread } = useUnreadCount();
  const { count: msgUnread } = useTotalUnread();
  const { count: footprintsUnread } = useFootprintsUnreadCount();
  const { preferences } = useNotificationPreferences();
  const footprintsBadgeEnabled = preferences?.footprintUnreadBadge !== false;
  const { hasAccess: karteAccess } = useMyKarteAccess();
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const onConfirmLogout = () => {
    setConfirmOpen(false);
    onClose();
    logout();
  };

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
          <p className="pt-1 text-xs text-text-secondary">
            <strong className="text-text-primary">{followingCount}</strong> フォロー中{" "}
            <strong className="text-text-primary">{followersCount}</strong> フォロワー
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const badgeCount =
              item.badgeKey === "unread" ? unread :
              item.badgeKey === "messaging_unread" ? msgUnread :
              item.badgeKey === "footprints_unread" ? (footprintsBadgeEnabled ? footprintsUnread : 0) :
              0;
            const showBadge = badgeCount > 0;
            // FALLBACK: Use /profile until the own profile has loaded.
            const href = item.path === "__profile__" ? (profile?.username ? `/u/${profile.username}` : "/profile") : item.path;
            return (
              <Link
                key={item.path}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-text-primary hover:bg-bg-secondary"
              >
                <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
          {karteAccess && (
            <Link
              href="/karte/my"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 text-text-primary hover:bg-bg-secondary"
            >
              <span className="text-2xl" aria-hidden="true">📋</span>
              <span className="flex-1">カルテ</span>
            </Link>
          )}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex w-full items-center gap-3 text-sm text-text-secondary hover:text-text-primary"
          >
            <Avatar
              src={profile?.avatarUrl || undefined}
              fallback={(profile?.displayName || "?").slice(0, 1)}
              size="sm"
            />
            <span className="flex-1 text-left">@{profile?.username || "—"}</span>
            <span aria-hidden="true">➜</span>
            <span className="sr-only">ログアウト</span>
          </button>
        </div>
      </aside>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4">
            <Dialog.Title className="text-base font-bold text-text-primary">ログアウトしますか？</Dialog.Title>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary" size="sm">キャンセル</Button>
              </Dialog.Close>
              <Button variant="primary" size="sm" onClick={onConfirmLogout}>ログアウト</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
