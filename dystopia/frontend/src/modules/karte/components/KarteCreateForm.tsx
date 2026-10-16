"use client";

import { useState } from "react";
import type { SocialProfileView } from "@/modules/social/types";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { KarteEventForm, emptyKarteEvent } from "./KarteEventForm";

interface KarteCreateFormProps {
  target: SocialProfileView;
  onCreated: () => void;
}

export function KarteCreateForm({ target, onCreated }: KarteCreateFormProps) {
  const { create, loading, error } = useKarteMutations();
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);

  return (
    <KarteEventForm
      guest={{ displayName: target.displayName, username: target.username, avatarUrl: target.avatarUrl }}
      value={event}
      onChange={setEvent}
      rating={{ value: rating, onChange: setRating }}
      submitLabel="記録中のカルテを作成"
      submitting={loading}
      error={error?.message ?? null}
      onSubmit={async () => {
        if (await create(target.profileId, rating, event)) onCreated();
      }}
    />
  );
}
