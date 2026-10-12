import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import { handleKarteApiError } from "@/modules/karte/lib/api-errors";
import { eventInput, karteEntryResponse, readKarteBody } from "@/modules/karte/lib/api-input";

type Context = { params: Promise<{ id: string; eventId: string }> };

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id, eventId } = await params;
    const event = eventInput(await readKarteBody(req));
    const res = await karteClient.updateEvent({ entryId: id, eventId, event }, { headers: await buildGrpcHeaders(req) });
    return karteEntryResponse(res.entry);
  } catch (error: unknown) {
    return handleKarteApiError(error, "UpdateKarteEvent");
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id, eventId } = await params;
    const res = await karteClient.deleteEvent({ entryId: id, eventId }, { headers: await buildGrpcHeaders(req) });
    return karteEntryResponse(res.entry);
  } catch (error: unknown) {
    return handleKarteApiError(error, "DeleteKarteEvent");
  }
}
