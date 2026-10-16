"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { revalidateKarte } from "../lib/revalidate";
import type { Karte, KarteEventInput } from "../types";

export function useKarteMutations() {
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
      void revalidateKarte();
    }
  }, []);

  const send = useCallback(
    (url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) =>
      run("カルテを更新できませんでした", async () => (await authFetch<{ karte: Karte }>(url, { method, body })).karte),
    [run]
  );

  const karteUrl = (karteId: string) => `/api/karte/${encodeURIComponent(karteId)}`;
  const eventUrl = (eventId: string) => `/api/karte/events/${encodeURIComponent(eventId)}`;

  const create = useCallback(
    (targetProfileId: string, rating: number | null, event: KarteEventInput) =>
      send("/api/karte", "POST", { targetProfileId, rating, event }),
    [send]
  );
  const updateRating = useCallback(
    (karteId: string, rating: number | null) => send(`${karteUrl(karteId)}/rating`, "PATCH", { rating }),
    [send]
  );
  const close = useCallback((karteId: string) => send(`${karteUrl(karteId)}/close`, "POST"), [send]);
  const reopen = useCallback((karteId: string) => send(`${karteUrl(karteId)}/reopen`, "POST"), [send]);
  const addEvent = useCallback(
    (karteId: string, event: KarteEventInput) => send(`${karteUrl(karteId)}/events`, "POST", { event }),
    [send]
  );
  const updateEvent = useCallback(
    (eventId: string, event: KarteEventInput) => send(eventUrl(eventId), "PATCH", { event }),
    [send]
  );
  const removeEvent = useCallback((eventId: string) => send(eventUrl(eventId), "DELETE"), [send]);
  const remove = useCallback(
    async (karteId: string) =>
      (await run("カルテを削除できませんでした", () => authFetch<{ ok: boolean }>(karteUrl(karteId), { method: "DELETE" }))) !== null,
    [run]
  );

  return { create, updateRating, close, reopen, addEvent, updateEvent, removeEvent, remove, loading, error };
}
