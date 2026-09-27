"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { authFetch } from "@/lib/auth";
import type { NotificationPreferences } from "@/modules/notifications/types";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  post: true,
  like: true,
  repost: true,
  quote: true,
  reply: true,
  follow: true,
  mention: true,
  message: true,
  oshi: true,
  footprintUnreadBadge: true,
  footprintsRecordMyVisits: true,
};

const KEY = "/api/notifications/preferences";

export function useNotificationPreferences() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading, mutate } = useSWR<NotificationPreferences>(
    userId ? KEY : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [updating, setUpdating] = useState(false);

  const preferences = data ?? DEFAULT_PREFERENCES;

  const update = useCallback(
    async (partial: Partial<NotificationPreferences>) => {
      const next: NotificationPreferences = { ...preferences, ...partial };
      await mutate(next, { revalidate: false });
      setUpdating(true);
      try {
        const saved = await authFetch<NotificationPreferences>(KEY, {
          method: "PUT",
          body: next,
        });
        await mutate(saved, { revalidate: false });
      } catch (e) {
        await mutate(undefined, { revalidate: true });
        throw e;
      } finally {
        setUpdating(false);
      }
    },
    [preferences, mutate]
  );

  return {
    preferences,
    loading: isLoading,
    updating,
    error,
    update,
    refresh: () => mutate(),
  };
}
