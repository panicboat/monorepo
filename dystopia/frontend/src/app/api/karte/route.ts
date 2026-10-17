import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/karte/lib/mappers";
import { parseKarteEventInput, parseRating } from "@/modules/karte/lib/input";
import { respondWithKarte } from "./karte-response";

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const body = await req.json().catch(() => null);
  const targetProfileId = typeof body?.targetProfileId === "string" ? body.targetProfileId : "";
  const event = parseKarteEventInput(body?.event);
  if (!targetProfileId || !event) {
    return NextResponse.json({ error: "targetProfileId and event required" }, { status: 400 });
  }
  return respondWithKarte(req, "CreateKarte", (headers) =>
    karteClient.createKarte(
      { targetProfileId, rating: parseRating(body?.rating), event: eventInputToMessage(event) },
      { headers }
    )
  );
}
