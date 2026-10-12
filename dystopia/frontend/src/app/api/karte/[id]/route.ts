import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import { handleKarteApiError } from "@/modules/karte/lib/api-errors";
import { entryInput, karteEntryResponse, readKarteBody } from "@/modules/karte/lib/api-input";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const res = await karteClient.getEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return karteEntryResponse(res.entry);
  } catch (error: unknown) {
    return handleKarteApiError(error, "GetKarte");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await readKarteBody(req);
    const res = await karteClient.updateEntry(
      { entryId: id, ...entryInput(body) },
      { headers: await buildGrpcHeaders(req) }
    );
    return karteEntryResponse(res.entry);
  } catch (error: unknown) {
    return handleKarteApiError(error, "UpdateKarte");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await karteClient.deleteEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleKarteApiError(error, "DeleteKarte");
  }
}
