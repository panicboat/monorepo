import { NextRequest } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { parseRating } from "@/modules/review/lib/input";
import { respondWithReview } from "../../review-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  return respondWithReview(req, "UpdateReviewRating", (headers) =>
    reviewClient.updateReviewRating({ reviewId: id, rating: parseRating(body?.rating) }, { headers })
  );
}
