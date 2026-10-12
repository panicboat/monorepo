"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RatingInput } from "@/components/ui/rating-input";
import { useCreateKarte } from "../hooks/useCreateKarte";
import { japanToday, validateKarte } from "../lib/validation";
import { KarteEventForm } from "./KarteEventForm";
import type { KarteEntry, KarteEventInput } from "../types";

interface Props {
  targetProfileId: string;
  onCreated?: (entry: KarteEntry) => void;
}

export function KarteComposer({ targetProfileId, onCreated }: Props) {
  const { create, loading, error } = useCreateKarte();
  const [rating, setRating] = useState<number | null>(null);
  const [event, setEvent] = useState<KarteEventInput>(() => ({ stage: "booking", outcome: "", tags: [], note: "", occurredOn: japanToday() }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const eventErrors = Object.fromEntries(Object.entries(errors).filter(([key]) => key.startsWith("events.0.")).map(([key, message]) => [key.slice("events.0.".length), message]));
  if (errors.note) eventErrors.note = errors.note;

  return (
    <form noValidate onSubmit={async (submit) => {
      submit.preventDefault();
      const invalid = validateKarte({ rating, events: [event] });
      setErrors(invalid);
      if (Object.keys(invalid).length) return;
      try {
        const entry = await create({ targetProfileId, rating, firstEvent: event });
        onCreated?.(entry);
      } catch {
        // SILENT: The mutation hook presents save errors while retaining the draft.
      }
    }} className="space-y-6 py-5">
      <KarteEventForm value={event} onChange={(value) => { setEvent(value); setErrors({}); }} errors={eventErrors} disabled={loading} />
      <div className="border-t border-divider pt-5">
        <p className="text-sm font-bold">予約・接客の信頼性 <span className="font-normal text-text-secondary">（任意）</span></p>
        <RatingInput value={rating} onChange={(value) => { setRating(value); setErrors({}); }} allowUnrated disabled={loading} />
        <p className="text-xs leading-relaxed text-text-secondary">3が標準です。印象や容姿ではなく、予約・接客の信頼性を評価してください。</p>
        {errors.rating && <p role="alert" className="pt-2 text-sm text-error">{errors.rating}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-error">{error.message}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? "保存中…" : "カルテを保存"}</Button>
    </form>
  );
}
