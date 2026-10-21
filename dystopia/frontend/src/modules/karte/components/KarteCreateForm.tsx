"use client";

import type { ProfileSummaryView } from "@/modules/profile/types";
import { useKarteMutations } from "../hooks/useKarteMutations";
import type { KarteEventInput } from "../types";
import { KarteEventForm } from "./KarteEventForm";

interface KarteCreateFormProps {
  target: ProfileSummaryView;
  event: KarteEventInput;
  onEventChange: (next: KarteEventInput) => void;
  rating: number | null;
  onRatingChange: (next: number | null) => void;
  onCreated: () => void;
}

export function KarteCreateForm({ target, event, onEventChange, rating, onRatingChange, onCreated }: KarteCreateFormProps) {
  const { create, loading, error } = useKarteMutations();

  return (
    <KarteEventForm
      guest={target}
      value={event}
      onChange={onEventChange}
      rating={{ value: rating, onChange: onRatingChange }}
      submitLabel="カルテを作成"
      submitting={loading}
      error={error?.message ?? null}
      onSubmit={async () => {
        if (await create(target.profileId, rating, event)) onCreated();
      }}
    />
  );
}
