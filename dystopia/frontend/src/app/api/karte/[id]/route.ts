import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapKarteEntryToView } from "@/modules/karte/lib/mappers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await req.json();
    const rating = body.rating === undefined ? 0 : Number(body.rating);
    const text = typeof body.body === "string" ? body.body : undefined;
    const res = await karteClient.updateEntry(
      { entryId: id, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
    const e = res.entry;
    if (!e) {
      return NextResponse.json({ error: "update returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({ entry: mapKarteEntryToView(e) });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateKarte");
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
    return handleApiError(error, "DeleteKarte");
  }
}
