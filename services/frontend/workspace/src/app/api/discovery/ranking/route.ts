import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { RankPeriod } from "@/stub/discovery/v1/discovery_service_pb";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapPostToView } from "@/modules/post/lib/post-mappers";

function periodFromString(s: string): RankPeriod {
  switch (s) {
    case "day": return RankPeriod.DAY;
    case "week": return RankPeriod.WEEK;
    case "all": return RankPeriod.ALL;
    default: return RankPeriod.WEEK;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const period = periodFromString(req.nextUrl.searchParams.get("period") || "week");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await discoveryClient.rankPosts({ period, limit, cursor }, { headers });
    return NextResponse.json({
      posts: (res.posts || []).map(mapPostToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "RankPosts");
  }
}
