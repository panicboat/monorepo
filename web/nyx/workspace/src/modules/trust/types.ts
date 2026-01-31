/**
 * Trust Module Types
 *
 * Types for reviews and CRM functionality.
 */

export interface Review {
  id: string;
  guestId: string;
  castId: string;
  rating: number; // 1-5
  content: string;
  tags?: string[];
  visitedAt: string;
  createdAt: string;
}

export interface ReviewWithGuest extends Review {
  guest: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface ReviewSummary {
  totalCount: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  topTags: Array<{
    tag: string;
    count: number;
  }>;
}

export interface CreateReviewPayload {
  castId: string;
  rating: number;
  content: string;
  tags?: string[];
  visitedAt: string;
}

export interface GuestInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  visitCount: number;
  lastVisitAt?: string;
  totalSpent: number;
  notes?: string;
  tags?: string[];
}
