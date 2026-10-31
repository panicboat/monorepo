"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { LockedNotice } from "@/components/ui/locked-notice";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { useCastReviews } from "../hooks/useCastReviews";
import { ReviewList } from "./ReviewList";
import { ReviewSummaryHeader } from "./ReviewSummaryHeader";

interface Composing {
  session: number;
  open: boolean;
}

export function CastReviewsTab({ cast }: { cast: ProfileSummaryView }) {
  const viewerRole = useAuthStore(selectRole);
  const viewerId = useAuthStore(selectActiveProfileId);
  const { reviews, summary, hiddenByLock, hasMore, loading, loadMore } = useCastReviews(cast.profileId);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);
  const canWrite = viewerRole === "guest" && viewerId !== cast.profileId;

  return (
    <div>
      {hiddenByLock ? (
        <LockedNotice />
      ) : (
        <>
          <ReviewSummaryHeader summary={summary} />
          <ReviewList reviews={reviews} variant="cast" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="クチコミはまだありません" />
        </>
      )}
      {canWrite && (
        <div className="px-4 py-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            このキャストのクチコミを書く
          </Button>
        </div>
      )}
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="review"
          open={composing.open}
          initialTarget={cast}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
