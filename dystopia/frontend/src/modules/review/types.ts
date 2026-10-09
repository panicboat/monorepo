export interface ReviewEntry {
  id: string;
  authorProfileId: string;
  targetProfileId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  targetUsername: string;
  targetAvatarUrl: string;
  rating: number;
  body: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedReviewByTargetResponse {
  entries: ReviewEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedReviewByAuthorResponse {
  entries: ReviewEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedReviewRecentResponse {
  entries: ReviewEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface ReviewSettings {
  reviewsVisible: boolean;
}
