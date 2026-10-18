import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/karte/lib/mappers";
import { parseKarteEventInput } from "@/modules/karte/lib/input";
import { respondWithKarte } from "../../karte-response";

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { eventId } = await params;
  const body = await req.json().catch(() => null);
  const event = parseKarteEventInput(body?.event);
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
  return respondWithKarte(req, "UpdateKarteEvent", (headers) =>
    karteClient.updateKarteEvent({ eventId, event: eventInputToMessage(event) }, { headers })
  );
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { eventId } = await params;
  return respondWithKarte(req, "DeleteKarteEvent", (headers) => karteClient.deleteKarteEvent({ eventId }, { headers }), {
    allowDeleted: true,
  });
}
