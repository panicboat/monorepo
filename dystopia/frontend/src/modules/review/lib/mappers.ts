import {
  ReviewStage as ReviewStageMessage,
  type Review as ReviewMessage,
  type ReviewCounts as ReviewCountsMessage,
  type ReviewEvent as ReviewEventMessage,
  type RatingSummary as RatingSummaryMessage,
} from "@/stub/review/v1/service_pb";
import { summaryToView } from "@/modules/profile/lib/mappers";
import type { Review, ReviewCounts, ReviewEvent, ReviewEventInput, ReviewStage, RatingSummary } from "@/modules/review/types";

const STAGE_TO_MESSAGE: Record<ReviewStage, ReviewStageMessage> = {
  reservation: ReviewStageMessage.RESERVATION,
  service: ReviewStageMessage.SERVICE,
  aftercare: ReviewStageMessage.AFTERCARE,
};

function toIsoString(timestamp: { seconds: bigint } | undefined): string {
  return timestamp ? new Date(Number(timestamp.seconds) * 1000).toISOString() : "";
}

function stageFromMessage(stage: ReviewStageMessage): ReviewStage {
  if (stage === ReviewStageMessage.SERVICE) return "service";
  if (stage === ReviewStageMessage.AFTERCARE) return "aftercare";
  // FALLBACK: The server never sends an unspecified stage, so read one as a reservation instead of failing the whole list.
  return "reservation";
}

export function mapReviewEventToView(event: ReviewEventMessage): ReviewEvent {
  return {
    id: event.id,
    stage: stageFromMessage(event.stage),
    outcome: event.outcome,
    tags: [...event.tags],
    note: event.note || "",
    occurredOn: event.occurredOn,
    createdAt: toIsoString(event.createdAt),
    updatedAt: toIsoString(event.updatedAt),
  };
}

export function mapReviewToView(review: ReviewMessage): Review {
  return {
    id: review.id,
    authorProfileId: review.authorProfileId,
    author: review.author ? summaryToView(review.author) : null,
    authorHidden: !!review.authorHidden,
    targetProfileId: review.targetProfileId,
    target: review.target ? summaryToView(review.target) : null,
    isMine: !!review.isMine,
    rating: review.rating === 0 ? null : review.rating,
    events: review.events.map(mapReviewEventToView),
    createdAt: toIsoString(review.createdAt),
    updatedAt: toIsoString(review.updatedAt),
    lastActivityAt: toIsoString(review.lastActivityAt),
  };
}

export function mapSummaryToView(summary: RatingSummaryMessage | undefined): RatingSummary {
  const reviewCount = summary?.reviewCount ?? 0;
  return {
    averageRating: summary && reviewCount > 0 ? summary.averageRating : null,
    raterCount: summary?.raterCount ?? 0,
    reviewCount,
  };
}

export function eventInputToMessage(input: ReviewEventInput) {
  return {
    stage: STAGE_TO_MESSAGE[input.stage],
    outcome: input.outcome,
    tags: input.tags,
    note: input.note,
    occurredOn: input.occurredOn,
  };
}

export function mapCountsToView(counts: ReviewCountsMessage | undefined): ReviewCounts {
  return { total: counts?.totalCount ?? 0, unrated: counts?.unratedCount ?? 0 };
}
