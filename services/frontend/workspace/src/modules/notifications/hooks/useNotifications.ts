"use client";

import useSWRInfinite from "swr/infinite";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedNotificationsResponse } from "../types";

export function useNotifications() {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedNotificationsResponse | null): string | null => {
    if (!userId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/notifications${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedNotificationsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const notifications = pages.flatMap((p) => p.notifications || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;
  const unreadCount = pages.length > 0 ? pages[0].unreadCount : 0;

  const markAllRead = useCallback(async () => {
    if (!useAuthStore.getState().userId) throw new Error("Not authenticated");
    const res = await fetch(`/api/notifications/mark-all-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to mark all read");
    }
    // optimistic: set readAt on all unread + zero unreadCount across pages
    const now = new Date().toISOString();
    mutate(
      (cur) =>
        cur?.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })),
          unreadCount: 0,
        })),
      { revalidate: false }
    );
  }, [mutate]);

  const markRead = useCallback(async (id: string) => {
    if (!useAuthStore.getState().userId) throw new Error("Not authenticated");
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to mark read");
    }
    // optimistic: bump readAt of the affected notification in cache
    const now = new Date().toISOString();
    mutate(
      (cur) =>
        cur?.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt || now } : n)),
          unreadCount: Math.max(0, page.unreadCount - (page.notifications.find((n) => n.id === id && !n.readAt) ? 1 : 0)),
        })),
      { revalidate: false }
    );
  }, [mutate]);

  return {
    notifications,
    hasMore,
    unreadCount,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    markRead,
    markAllRead,
    refresh: () => mutate(),
  };
}
