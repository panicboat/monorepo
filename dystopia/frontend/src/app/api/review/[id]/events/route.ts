import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/review/lib/mappers";
import { parseReviewEventInput } from "@/modules/review/lib/input";
import { respondWithReview } from "../../review-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const event = parseReviewEventInput(body?.event);
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
  return respondWithReview(req, "AddReviewEvent", (headers) =>
    reviewClient.addReviewEvent({ reviewId: id, event: eventInputToMessage(event) }, { headers })
  );
}
