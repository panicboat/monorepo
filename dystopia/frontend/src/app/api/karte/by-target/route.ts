import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import { handleKarteApiError } from "@/modules/karte/lib/api-errors";
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
        avgRating: res.aggregate?.avgRating ?? null,
        authorCount: res.aggregate?.authorCount ?? 0,
        ratedCount: res.aggregate?.ratedCount ?? 0,
      },
    });
  } catch (error: unknown) {
    return handleKarteApiError(error, "ListKarteByTarget");
  }
}
