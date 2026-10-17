import type { Review } from "../types";

export function uniqueReviews(reviews: Review[]): Review[] {
  const seen = new Set<string>();
  return reviews.filter((review) => {
    if (seen.has(review.id)) return false;
    seen.add(review.id);
    return true;
  });
}
