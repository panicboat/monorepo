import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/review/lib/mappers";
import { parseReviewEventInput, parseRating } from "@/modules/review/lib/input";
import { respondWithReview } from "./review-response";

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const body = await req.json().catch(() => null);
  const targetProfileId = typeof body?.targetProfileId === "string" ? body.targetProfileId : "";
  const event = parseReviewEventInput(body?.event);
  if (!targetProfileId || !event) {
    return NextResponse.json({ error: "targetProfileId and event required" }, { status: 400 });
  }
  return respondWithReview(req, "CreateReview", (headers) =>
    reviewClient.createReview(
      { targetProfileId, rating: parseRating(body?.rating), event: eventInputToMessage(event) },
      { headers }
    )
  );
}
