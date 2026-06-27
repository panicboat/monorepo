import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const body = await req.json();
    const targetAccountId = body.targetAccountId as string | undefined;
    const rating = Number(body.rating);
    const text = (body.body as string | undefined) ?? "";
    if (!targetAccountId || !Number.isFinite(rating)) {
      return NextResponse.json({ error: "targetAccountId and rating required" }, { status: 400 });
    }
    const res = await karteClient.createEntry(
      { targetAccountId, rating, body: text },
      { headers: buildGrpcHeaders(req) }
    );
    return NextResponse.json({ entry: res.entry });
  } catch (error: unknown) {
    return handleApiError(error, "CreateKarte");
  }
}
