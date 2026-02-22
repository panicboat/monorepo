export interface Tagging {
  id: string;
  tagName: string;
  taggerId: string;
  createdAt: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content?: string;
  score: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface ReviewStats {
  averageScore: number;
  totalReviews: number;
  approvalRate: number;
}

export interface CreateReviewRequest {
  revieweeId: string;
  content?: string;
  score: number;
}

export interface CreateReviewResponse {
  success: boolean;
  id?: string;
}

export interface UpdateReviewRequest {
  id: string;
  content?: string;
  score: number;
}

export interface ListReviewsResponse {
  reviews: Review[];
}

export interface ReviewStatsResponse {
  stats: ReviewStats;
}

export interface PendingReviewsResponse {
  reviews: Review[];
}
