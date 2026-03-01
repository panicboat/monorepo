/**
 * Proto の Trust オブジェクトを API レスポンス用 JSON にマッピング。
 * API route (BFF) で使用。
 */

interface ProtoReviewMedia {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl?: string;
}

interface ProtoReview {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content?: string;
  score: number;
  status: string;
  createdAt: string;
  reviewerName?: string;
  reviewerAvatarUrl?: string;
  media?: ProtoReviewMedia[];
}

interface ProtoReviewStats {
  averageScore: number;
  totalReviews: number;
  approvalRate: number;
}

interface ProtoTagging {
  id: string;
  tagName: string;
  taggerId: string;
  createdAt: string;
}

export function mapProtoReviewToJson(review: ProtoReview) {
  return {
    id: review.id,
    reviewerId: review.reviewerId,
    revieweeId: review.revieweeId,
    content: review.content,
    score: review.score,
    status: review.status,
    createdAt: review.createdAt,
    reviewerName: review.reviewerName,
    reviewerAvatarUrl: review.reviewerAvatarUrl,
    media: (review.media || []).map((m) => ({
      id: m.id,
      mediaType: m.mediaType as "image" | "video",
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    })),
  };
}

// FALLBACK: Returns empty array when response reviews is missing
export function mapProtoReviewsListToJson(response: {
  reviews: ProtoReview[];
  nextCursor?: string;
  hasMore?: boolean;
}) {
  return {
    reviews: (response.reviews || []).map(mapProtoReviewToJson),
    nextCursor: response.nextCursor || null,
    hasMore: response.hasMore || false,
  };
}

export function mapProtoReviewStatsToJson(
  stats: ProtoReviewStats | null | undefined
) {
  if (!stats) return null;
  return {
    averageScore: stats.averageScore,
    totalReviews: stats.totalReviews,
    approvalRate: stats.approvalRate,
  };
}

export function mapProtoTaggingToJson(tagging: ProtoTagging) {
  return {
    id: tagging.id,
    tagName: tagging.tagName,
    taggerId: tagging.taggerId,
    createdAt: tagging.createdAt,
  };
}

// FALLBACK: Returns empty array when response taggings is missing
export function mapProtoTaggingsListToJson(response: {
  taggings: ProtoTagging[];
}) {
  return {
    taggings: (response.taggings || []).map(mapProtoTaggingToJson),
  };
}
