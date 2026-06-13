import { NextRequest, NextResponse } from "next/server";
import { feedClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";
import { feedFilterFromString, mapFeedListResponse } from "@/modules/feed/lib/mappers";
import type { FeedFilterValue } from "@/modules/feed/types";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);
    const filterRaw = (req.nextUrl.searchParams.get("filter") || "all") as FeedFilterValue;
    const prefecture = req.nextUrl.searchParams.get("prefecture") || "";

    const filter = feedFilterFromString(filterRaw);

    const res = await feedClient.listFeed(
      { filter, limit, cursor, prefecture },
      { headers }
    );
    return NextResponse.json(mapFeedListResponse(res));
  } catch (error: unknown) {
    return handleApiError(error, "ListFeed");
  }
}
