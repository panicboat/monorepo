"use client";

import type { ProfileSummaryView } from "@/modules/profile/types";
import { useReviewMutations } from "../hooks/useReviewMutations";
import type { ReviewEventInput } from "../types";
import { ReviewEventForm } from "./ReviewEventForm";

interface ReviewCreateFormProps {
  target: ProfileSummaryView;
  event: ReviewEventInput;
  onEventChange: (next: ReviewEventInput) => void;
  rating: number | null;
  onRatingChange: (next: number | null) => void;
  onCreated: () => void;
}

export function ReviewCreateForm({ target, event, onEventChange, rating, onRatingChange, onCreated }: ReviewCreateFormProps) {
  const { create, loading, error } = useReviewMutations();

  return (
    <ReviewEventForm
      cast={target}
      value={event}
      onChange={onEventChange}
      rating={{ value: rating, onChange: onRatingChange }}
      submitLabel="記録中のクチコミを作成"
      submitting={loading}
      error={error?.message ?? null}
      onSubmit={async () => {
        if (await create(target.profileId, rating, event)) onCreated();
      }}
    />
  );
}
