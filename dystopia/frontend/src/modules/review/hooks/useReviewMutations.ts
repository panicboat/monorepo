"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { revalidateReview } from "../lib/revalidate";
import type { Review, ReviewEventInput } from "../types";

export function useReviewMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async <T>(fallback: string, request: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await request();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(fallback));
      return null;
    } finally {
      setLoading(false);
      void revalidateReview();
    }
  }, []);

  const send = useCallback(
    (url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) =>
      run("クチコミを更新できませんでした", async () => (await authFetch<{ review: Review }>(url, { method, body })).review),
    [run]
  );

  const reviewUrl = (reviewId: string) => `/api/review/${encodeURIComponent(reviewId)}`;
  const eventUrl = (eventId: string) => `/api/review/events/${encodeURIComponent(eventId)}`;

  const create = useCallback(
    (targetProfileId: string, rating: number | null, event: ReviewEventInput) =>
      send("/api/review", "POST", { targetProfileId, rating, event }),
    [send]
  );
  const updateRating = useCallback(
    (reviewId: string, rating: number | null) => send(`${reviewUrl(reviewId)}/rating`, "PATCH", { rating }),
    [send]
  );
  const addEvent = useCallback(
    (reviewId: string, event: ReviewEventInput) => send(`${reviewUrl(reviewId)}/events`, "POST", { event }),
    [send]
  );
  const updateEvent = useCallback(
    (eventId: string, event: ReviewEventInput) => send(eventUrl(eventId), "PATCH", { event }),
    [send]
  );
  const removeEvent = useCallback(
    (eventId: string) =>
      run("クチコミを更新できませんでした", () => authFetch<{ review: Review | null }>(eventUrl(eventId), { method: "DELETE" })),
    [run]
  );
  const remove = useCallback(
    async (reviewId: string) =>
      (await run("クチコミを削除できませんでした", () => authFetch<{ ok: boolean }>(reviewUrl(reviewId), { method: "DELETE" }))) !== null,
    [run]
  );

  return { create, updateRating, addEvent, updateEvent, removeEvent, remove, loading, error };
}
