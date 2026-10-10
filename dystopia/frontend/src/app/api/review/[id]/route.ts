import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import type { ReviewEntry } from "@/modules/review/types";

function entryToView(e: NonNullable<Awaited<ReturnType<typeof reviewClient.updateEntry>>["entry"]>): ReviewEntry {
  return {
    id: e.id,
    authorProfileId: e.authorProfileId,
    targetProfileId: e.targetProfileId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    targetUsername: e.targetUsername || "",
    targetAvatarUrl: e.targetAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await req.json();
    const rating = body.rating === undefined ? 0 : Number(body.rating);
    const text = typeof body.body === "string" ? body.body : undefined;
    const res = await reviewClient.updateEntry(
      { entryId: id, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
    if (!res.entry) {
      return NextResponse.json({ error: "update returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({ entry: entryToView(res.entry) });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateReview");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await reviewClient.deleteEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteReview");
  }
}
