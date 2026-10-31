import type { ProfileSummaryView } from "@/modules/profile/types";

export type ReviewStage = "reservation" | "service" | "aftercare";

export interface ReviewEvent {
  id: string;
  stage: ReviewStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  authorProfileId: string;
  author: ProfileSummaryView | null;
  authorHidden: boolean;
  targetProfileId: string;
  target: ProfileSummaryView | null;
  isMine: boolean;
  rating: number | null;
  events: ReviewEvent[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface ReviewEventInput {
  stage: ReviewStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
}

export interface RatingSummary {
  averageRating: number | null;
  raterCount: number;
  reviewCount: number;
}

export interface ReviewPage {
  reviews: Review[];
  nextCursor: string;
  hasMore: boolean;
  hiddenByLock?: boolean;
}

export interface ReviewsByTargetPage extends ReviewPage {
  summary: RatingSummary;
}

export interface ReviewCounts {
  total: number;
  unrated: number;
}

export interface MyReviewPage extends ReviewPage {
  counts: ReviewCounts;
}
