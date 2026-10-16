"use client";

import { useCallback, useState } from "react";
import type { Karte } from "../types";
import { KarteCard } from "./KarteCard";
import { KarteDetailSheet } from "./KarteDetailSheet";

interface Opened {
  karte: Karte;
  session: number;
  open: boolean;
}

interface KarteListProps {
  kartes: Karte[];
  variant: "feed" | "guest" | "mine";
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  empty: string;
}

export function KarteList({ kartes, variant, hasMore, loading, onLoadMore, empty }: KarteListProps) {
  // Keep the opened karte after closing: dropping it would unmount the sheet before it slides out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const close = useCallback(() => setOpened((current) => current && { ...current, open: false }), []);

  return (
    <div>
      {kartes.map((karte) => (
        <KarteCard
          key={karte.id}
          karte={karte}
          variant={variant}
          onOpen={(chosen) => setOpened((current) => ({ karte: chosen, session: (current?.session ?? 0) + 1, open: true }))}
        />
      ))}
      {!loading && kartes.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-secondary">{empty}</p>}
      {loading && kartes.length === 0 && <div className="px-4 py-3 text-sm text-text-secondary">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="block w-full px-4 py-3 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          もっと見る
        </button>
      )}
      {opened && <KarteDetailSheet key={opened.session} karte={opened.karte} open={opened.open} onClose={close} />}
    </div>
  );
}
