"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";
import type { ReviewSettings } from "../types";

export function useReviewSettings() {
  const userId = useAuthStore((s) => s.userId);
  const { data, isLoading, mutate } = useSWR<ReviewSettings>(
    userId ? "/api/review/settings" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const [saving, setSaving] = useState(false);

  const update = useCallback(async (reviewsVisible: boolean) => {
    setSaving(true);
    try {
      const res = await authFetch<ReviewSettings>("/api/review/settings", {
        method: "PATCH",
        body: { reviewsVisible },
      });
      await mutate(res, { revalidate: false });
      return res;
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  return {
    reviewsVisible: data?.reviewsVisible ?? true,
    loading: isLoading,
    saving,
    update,
  };
}
