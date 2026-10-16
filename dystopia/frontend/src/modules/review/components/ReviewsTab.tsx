"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import type { SocialProfileView } from "@/modules/social/types";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useReviewsByAuthor } from "../hooks/useReviewsByAuthor";
import { useReviewsByTarget } from "../hooks/useReviewsByTarget";
import { ReviewList } from "./ReviewList";

interface Props {
  profileId: string;
  mode: "received" | "written";
  target?: SocialProfileView;
}

export function ReviewsTab({ profileId, mode, target }: Props) {
  const viewerRole = useAuthStore(selectRole);
  const byTarget = useReviewsByTarget(mode === "received" ? profileId : null);
  const byAuthor = useReviewsByAuthor(mode === "written" ? profileId : null);
  const { entries, hasMore, loading, loadMore, refresh } = mode === "received" ? byTarget : byAuthor;
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<{ session: number; open: boolean } | null>(null);
  const canWrite = mode === "received" && viewerRole === "guest" && !!target;

  return (
    <div>
      <ReviewList
        entries={entries}
        variant={mode === "received" ? "target" : "author"}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
        onChanged={refresh}
        empty="まだレビューはありません。"
      />
      {canWrite && (
        <div className="px-4 py-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            レビューを書く
          </Button>
        </div>
      )}
      {composing && target && (
        <ComposeToSheet
          key={composing.session}
          kind="review"
          open={composing.open}
          initialTarget={target}
          onSaved={refresh}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
