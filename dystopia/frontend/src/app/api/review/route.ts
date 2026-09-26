import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

function entryToView(e: NonNullable<Awaited<ReturnType<typeof reviewClient.createEntry>>["entry"]>) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

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
    const res = await reviewClient.createEntry(
      { targetAccountId, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
    if (!res.entry) {
      return NextResponse.json({ error: "create returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({ entry: entryToView(res.entry) });
  } catch (error: unknown) {
    return handleApiError(error, "CreateReview");
  }
}
