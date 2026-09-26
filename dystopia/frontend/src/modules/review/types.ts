export interface ReviewEntry {
  id: string;
  authorAccountId: string;
  targetAccountId: string;
  authorUsername: string;
  authorAvatarUrl: string;
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

export interface ReviewSettings {
  reviewsVisible: boolean;
}
