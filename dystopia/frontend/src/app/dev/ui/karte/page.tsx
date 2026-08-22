"use client";

import { KarteAggregateHeader } from "@/modules/karte/components/KarteAggregateHeader";
import { KarteComposer } from "@/modules/karte/components/KarteComposer";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import type { KarteAggregate, KarteEntry } from "@/modules/karte/types";

const mockAggregate: KarteAggregate = {
  count: 2,
  avgRating: 4.0,
};

const mockEntries: KarteEntry[] = [
  {
    id: "k1",
    authorAccountId: "cast-demo",
    targetAccountId: "guest-demo",
    authorUsername: "yuna",
    authorAvatarUrl: "",
    rating: 5,
    body: "とても丁寧で好印象でした。また来てほしいです。",
    flagged: false,
    createdAt: "2026-06-20T10:00:00Z",
    updatedAt: "2026-06-20T10:00:00Z",
  },
  {
    id: "k2",
    authorAccountId: "cast-other",
    targetAccountId: "guest-demo",
    authorUsername: "sakura",
    authorAvatarUrl: "",
    rating: 3,
    body: "",
    flagged: true,
    createdAt: "2026-06-18T14:30:00Z",
    updatedAt: "2026-06-18T14:30:00Z",
  },
];

export default function DevUiKartePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteAggregateHeader</h2>
        <div className="border border-divider rounded-lg overflow-hidden">
          <KarteAggregateHeader aggregate={mockAggregate} />
        </div>
        <div className="mt-3 border border-divider rounded-lg overflow-hidden">
          <KarteAggregateHeader aggregate={{ count: 0, avgRating: 0 }} />
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteComposer (no live API)</h2>
        <div className="border border-divider rounded-lg overflow-hidden">
          <KarteComposer targetAccountId="guest-demo-noop" />
        </div>
      </section>

      <section className="flex flex-col">
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteEntryCard</h2>
        {mockEntries.map((e) => (
          <KarteEntryCard key={e.id} entry={e} />
        ))}
      </section>
    </main>
  );
}
