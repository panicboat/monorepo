import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

type ListEntry = Awaited<ReturnType<typeof reviewClient.listEntriesByTarget>>["entries"][number];

function entryToView(e: ListEntry) {
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

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const targetProfileId = req.nextUrl.searchParams.get("profile_id") || "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listEntriesByTarget({ targetProfileId, limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map(entryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviewsByTarget");
  }
}
