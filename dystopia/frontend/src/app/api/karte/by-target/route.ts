import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapKarteEntryToView } from "@/modules/karte/lib/mappers";

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
    const res = await karteClient.listEntriesByTarget(
      { targetProfileId, limit, cursor },
      { headers }
    );
    return NextResponse.json({
      entries: (res.entries || []).map(mapKarteEntryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      aggregate: {
        count: res.aggregate?.count || 0,
        avgRating: res.aggregate?.avgRating || 0,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListKarteByTarget");
  }
}
