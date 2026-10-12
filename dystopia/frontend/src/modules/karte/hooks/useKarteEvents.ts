"use client";

import { useCallback } from "react";
import type { KarteEntry, KarteEventInput } from "../types";
import { useKarteMutation } from "./useKarteMutation";

export function useKarteEvents(id: string) {
  const { run, loading, error } = useKarteMutation<{ entry: KarteEntry }>();
  const add = useCallback(async (event: KarteEventInput): Promise<KarteEntry> => (await run(`/api/karte/${id}/events`, { method: "POST", body: event })).entry, [id, run]);
  const update = useCallback(async (eventId: string, event: KarteEventInput): Promise<KarteEntry> => (await run(`/api/karte/${id}/events/${eventId}`, { method: "PATCH", body: event })).entry, [id, run]);
  const remove = useCallback(async (eventId: string): Promise<KarteEntry> => (await run(`/api/karte/${id}/events/${eventId}`, { method: "DELETE" })).entry, [id, run]);
  return { add, update, remove, loading, error };
}
