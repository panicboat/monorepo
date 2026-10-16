import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/karte/lib/mappers";
import { parseKarteEventInput } from "@/modules/karte/lib/input";
import { respondWithKarte } from "../../karte-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const event = parseKarteEventInput(body?.event);
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
  return respondWithKarte(req, "AddKarteEvent", (headers) =>
    karteClient.addKarteEvent({ karteId: id, event: eventInputToMessage(event) }, { headers })
  );
}
