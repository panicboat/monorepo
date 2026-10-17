import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/review/lib/mappers";
import { parseReviewEventInput } from "@/modules/review/lib/input";
import { respondWithReview } from "../../review-response";

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { eventId } = await params;
  const body = await req.json().catch(() => null);
  const event = parseReviewEventInput(body?.event);
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
  return respondWithReview(req, "UpdateReviewEvent", (headers) =>
    reviewClient.updateReviewEvent({ eventId, event: eventInputToMessage(event) }, { headers })
  );
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { eventId } = await params;
  return respondWithReview(req, "DeleteReviewEvent", (headers) => reviewClient.deleteReviewEvent({ eventId }, { headers }));
}
