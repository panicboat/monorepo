"use client";

import { KarteAggregateHeader } from "@/modules/karte/components/KarteAggregateHeader";
import { KarteComposer } from "@/modules/karte/components/KarteComposer";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import type { Karte } from "@/modules/karte/types";

const mockKartes: Karte[] = [
  {
    id: "k1",
    authorProfileId: "cast-demo",
    authorUsername: "yuna",
    authorAvatarUrl: "",
    targetProfileId: "guest-demo",
    targetUsername: "guest_demo",
    targetAvatarUrl: "",
    isMine: true,
    rating: null,
    status: "open",
    events: [
      { id: "e1", stage: "reservation", outcome: "booked", tags: ["smooth_contact"], note: "", occurredOn: "2026-10-10", createdAt: "", updatedAt: "" },
    ],
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-10T10:00:00Z",
    closedAt: null,
  },
  {
    id: "k2",
    authorProfileId: "cast-other",
    authorUsername: "sakura",
    authorAvatarUrl: "",
    targetProfileId: "guest-demo",
    targetUsername: "guest_demo",
    targetAvatarUrl: "",
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
  },
];

export default function DevUiKartePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteAggregateHeader</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          <KarteAggregateHeader reliability={{ averageRating: 3.8, raterCount: 8, karteCount: 12 }} />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-divider">
          <KarteAggregateHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteComposer (no live API)</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          <KarteComposer targetProfileId="guest-demo-noop" />
        </div>
      </section>

      <section className="flex flex-col">
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteEntryCard</h2>
        {mockKartes.map((karte) => (
          <KarteEntryCard key={karte.id} karte={karte} mode="target" />
        ))}
      </section>
    </main>
  );
}
