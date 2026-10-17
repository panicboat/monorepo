"use client";

import { useState } from "react";
import { KarteCard } from "@/modules/karte/components/KarteCard";
import { KarteEventForm, emptyKarteEvent } from "@/modules/karte/components/KarteEventForm";
import { StarRatingInput } from "@/components/ui/star-rating-input";
import { KarteReliabilityHeader } from "@/modules/karte/components/KarteReliabilityHeader";
import type { Karte } from "@/modules/karte/types";

const mockKartes: Karte[] = [
  {
    id: "k1",
    authorProfileId: "cast-demo",
    author: { profileId: "cast-demo", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" },
    targetProfileId: "guest-demo",
    target: { profileId: "guest-demo", username: "guest_demo", displayName: "ゲスト", avatarUrl: "", isPrivate: false, role: "guest" },
    isMine: true,
    rating: null,
    status: "open",
    events: [
      { id: "e1", stage: "reservation", outcome: "booked", tags: ["smooth_contact"], note: "", occurredOn: "2026-10-10", createdAt: "", updatedAt: "" },
    ],
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-10T10:00:00Z",
    closedAt: null,
    lastActivityAt: "2026-10-10T10:00:00Z",
  },
  {
    id: "k2",
    authorProfileId: "cast-other",
    author: { profileId: "cast-other", username: "sakura", displayName: "さくら", avatarUrl: "", isPrivate: false, role: "cast" },
    targetProfileId: "guest-demo",
    target: { profileId: "guest-demo", username: "guest_demo", displayName: "ゲスト", avatarUrl: "", isPrivate: false, role: "guest" },
    isMine: false,
    rating: 2,
    status: "closed",
    events: [
      { id: "e2", stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" },
      { id: "e3", stage: "service", outcome: "completed_with_issues", tags: ["late"], note: "30分遅刻", occurredOn: "2026-10-02", createdAt: "", updatedAt: "" },
    ],
    createdAt: "2026-10-01T14:30:00Z",
    updatedAt: "2026-10-02T14:30:00Z",
    closedAt: "2026-10-02T15:00:00Z",
    lastActivityAt: "2026-10-02T15:00:00Z",
  },
];

export default function DevUiKartePage() {
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteReliabilityHeader</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          <KarteReliabilityHeader reliability={{ averageRating: 3.8, raterCount: 8, karteCount: 12 }} />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-divider">
          <KarteReliabilityHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteCard</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          {mockKartes.map((karte) => (
            <KarteCard key={karte.id} karte={karte} variant="feed" onOpen={() => {}} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">StarRatingInput</h2>
        <StarRatingInput label="予約・接客の信頼性" value={rating} onChange={setRating} />
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteEventForm</h2>
        <KarteEventForm
          guest={{ profileId: "guest-demo", displayName: "ゲスト", username: "guest_demo", avatarUrl: "", isPrivate: false, role: "guest" }}
          value={event}
          onChange={setEvent}
          rating={{ value: rating, onChange: setRating }}
          submitLabel="記録中のカルテを作成"
          submitting={false}
          error={null}
          onSubmit={() => {}}
        />
      </section>
    </main>
  );
}
