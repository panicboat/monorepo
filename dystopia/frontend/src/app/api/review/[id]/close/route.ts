import { NextRequest } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { respondWithReview } from "../../review-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  return respondWithReview(req, "CloseReview", (headers) => reviewClient.closeReview({ reviewId: id }, { headers }));
}
