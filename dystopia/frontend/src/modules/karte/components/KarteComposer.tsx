"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { KarteEventFields, emptyKarteEvent, isKarteEventReady } from "./KarteEventFields";
import { KarteRatingSelect } from "./KarteRatingSelect";

interface KarteComposerProps {
  targetProfileId: string;
  onCreated?: () => void;
}

export function KarteComposer({ targetProfileId, onCreated }: KarteComposerProps) {
  const { create, loading, error } = useKarteMutations();
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await create(targetProfileId, rating, event))) return;
        setEvent(emptyKarteEvent());
        setRating(null);
        onCreated?.();
      }}
      className="flex flex-col gap-3 border-b border-border p-4"
    >
      <KarteEventFields value={event} onChange={setEvent} />
      <KarteRatingSelect value={rating} onChange={setRating} />
      <p className="text-xs text-text-secondary">星は記録中なら未評価のままにできます。完了するときに必要です。</p>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error.message}
        </p>
      )}
      <Button type="submit" size="sm" disabled={loading || !isKarteEventReady(event)}>
        カルテを作成
      </Button>
    </form>
  );
}
