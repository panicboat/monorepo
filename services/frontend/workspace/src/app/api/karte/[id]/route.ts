import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await req.json();
    const rating = body.rating === undefined ? 0 : Number(body.rating);
    const text = typeof body.body === "string" ? body.body : "";
    const res = await karteClient.updateEntry(
      { entryId: id, rating, body: text },
      { headers: buildGrpcHeaders(req) }
    );
    const e = res.entry;
    if (!e) {
      return NextResponse.json({ error: "update returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({
      entry: {
        id: e.id,
        authorAccountId: e.authorAccountId,
        targetAccountId: e.targetAccountId,
        authorUsername: e.authorUsername || "",
        authorAvatarUrl: e.authorAvatarUrl || "",
        rating: e.rating,
        body: e.body || "",
        flagged: !!e.flagged,
        createdAt: e.createdAt
          ? new Date(Number(e.createdAt.seconds) * 1000).toISOString()
          : "",
        updatedAt: e.updatedAt
          ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString()
          : "",
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateKarte");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await karteClient.deleteEntry({ entryId: id }, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteKarte");
  }
}
