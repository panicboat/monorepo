import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listMyEntries({ limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map((e) => ({
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
      })),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyKarte");
  }
}
