"use client";

import type { SocialProfileView } from "@/modules/social/types";
import { useKarteMutations } from "../hooks/useKarteMutations";
import type { KarteEventInput } from "../types";
import { KarteEventForm } from "./KarteEventForm";

interface KarteCreateFormProps {
  target: SocialProfileView;
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
      guest={{ displayName: target.displayName, username: target.username, avatarUrl: target.avatarUrl }}
      value={event}
      onChange={onEventChange}
      rating={{ value: rating, onChange: onRatingChange }}
      submitLabel="記録中のカルテを作成"
      submitting={loading}
      error={error?.message ?? null}
      onSubmit={async () => {
        if (await create(target.profileId, rating, event)) onCreated();
      }}
    />
  );
}
