"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import type { SocialProfileView } from "@/modules/social/types";
import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteList } from "./KarteList";
import { KarteReliabilityHeader } from "./KarteReliabilityHeader";

interface Composing {
  session: number;
  open: boolean;
}

export function GuestKarteTab({ guest }: { guest: SocialProfileView }) {
  const { kartes, reliability, hasMore, loading, loadMore } = useGuestKarte(guest.profileId);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);

  return (
    <div>
      <KarteReliabilityHeader reliability={reliability} />
      <KarteList kartes={kartes} variant="guest" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="カルテはまだありません" />
      <div className="px-4 py-4">
        <Button
          type="button"
          className="w-full"
          onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
        >
          このゲストのカルテを書く
        </Button>
      </div>
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="karte"
          open={composing.open}
          initialTarget={guest}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
