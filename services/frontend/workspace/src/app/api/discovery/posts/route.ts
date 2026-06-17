import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapPostToView } from "@/modules/post/lib/post-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const query = req.nextUrl.searchParams.get("q") || "";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await discoveryClient.searchPosts({ query, limit, cursor }, { headers });
    return NextResponse.json({
      posts: (res.posts || []).map(mapPostToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "SearchPosts");
  }
}
