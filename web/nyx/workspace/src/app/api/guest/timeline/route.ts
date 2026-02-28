import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { mapProtoPostsListToJson } from "@/modules/post/lib/api-mappers";
import { extractPaginationParams, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);
    const castUserId = req.nextUrl.searchParams.get("cast_id") || "";
    const filterParam = req.nextUrl.searchParams.get("filter") || "";

    // Use "public" filter by default to force public timeline even for Cast users
    // Only override if specific filter is requested (e.g., "following")
    const filter = filterParam || "public";

    const response = await postClient.listCastPosts(
      { castUserId, limit, cursor, filter },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoPostsListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListPublicPosts");
  }
}
