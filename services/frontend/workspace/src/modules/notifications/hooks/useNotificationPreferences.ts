"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
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
};

const KEY = "/api/notifications/preferences";

export function useNotificationPreferences() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<NotificationPreferences>(
    token ? KEY : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [updating, setUpdating] = useState(false);

  const preferences = data ?? DEFAULT_PREFERENCES;

  const update = useCallback(
    async (partial: Partial<NotificationPreferences>) => {
      const next: NotificationPreferences = { ...preferences, ...partial };
      // Optimistic mutate so the toggle reflects the new state immediately.
      await mutate(next, { revalidate: false });
      setUpdating(true);
      try {
        const saved = await authFetch<NotificationPreferences>(KEY, {
          method: "PUT",
          body: next,
        });
        await mutate(saved, { revalidate: false });
      } catch (e) {
        // Roll back on failure so UI matches server.
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
