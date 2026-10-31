"use client";

import { useSWRConfig } from "swr";
import { useCallback } from "react";
import { useCursorPages } from "@/lib/hooks/useCursorPages";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedNotificationsResponse } from "../types";
import { UNREAD_COUNT_KEY } from "./useUnreadCount";

export function useNotifications() {
  const { mutate: mutateGlobal } = useSWRConfig();

  const { pages, hasMore, loading, error, loadMore, refresh, mutate } = useCursorPages<PaginatedNotificationsResponse>("/api/notifications");
  const notifications = pages.flatMap((p) => p.notifications || []);
  const unreadCount = pages.length > 0 ? pages[0].unreadCount : 0;

  const markAllRead = useCallback(async () => {
    if (!useAuthStore.getState().activeProfileId) throw new Error("Not authenticated");
    await authFetch(`/api/notifications/mark-all-read`, { method: "POST" });
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
    void mutateGlobal(UNREAD_COUNT_KEY);
  }, [mutate, mutateGlobal]);

  const markRead = useCallback(async (id: string) => {
    if (!useAuthStore.getState().activeProfileId) throw new Error("Not authenticated");
    await authFetch(`/api/notifications/${id}/read`, { method: "POST" });
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
    void mutateGlobal(UNREAD_COUNT_KEY);
  }, [mutate, mutateGlobal]);

  return {
    notifications,
    hasMore,
    unreadCount,
    loading,
    error,
    loadMore,
    markRead,
    markAllRead,
    refresh,
  };
}
