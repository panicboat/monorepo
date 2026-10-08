import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapKarteEntryToView } from "@/modules/karte/lib/mappers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const body = await req.json();
    const targetProfileId = body.targetProfileId as string | undefined;
    const rating = Number(body.rating);
    const text = (body.body as string | undefined) ?? "";
    if (!targetProfileId || !Number.isFinite(rating)) {
      return NextResponse.json({ error: "targetProfileId and rating required" }, { status: 400 });
    }
    const res = await karteClient.createEntry(
      { targetProfileId, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
    const e = res.entry;
    if (!e) {
      return NextResponse.json({ error: "create returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({ entry: mapKarteEntryToView(e) });
  } catch (error: unknown) {
    return handleApiError(error, "CreateKarte");
  }
}
