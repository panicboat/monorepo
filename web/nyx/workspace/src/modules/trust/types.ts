/**
 * Trust domain types
 * Reviews, ratings, and reliability scoring
 */

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;
  castId: string;
  guestId: string;
  rating: ReviewRating;
  comment?: string;
  createdAt: string;
  visible: boolean;
}

export interface TrustScore {
  overall: number; // 0-999
  reliability: number; // Vow completion rate
  responseRate: number;
  repeatRate: number;
}

export interface CastTrustMetrics {
  castId: string;
  trustScore: TrustScore;
  totalReviews: number;
  averageRating: number;
}

export interface GuestTrustMetrics {
  guestId: string;
  trustScore: TrustScore;
  totalBookings: number;
  completionRate: number;
}
