import { NextRequest, NextResponse } from "next/server";
import { feedClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { FeedFilter } from "@/stub/feed/v1/feed_service_pb";
import { mapProtoPostsListToJson } from "@/modules/post/lib/api-mappers";
import { extractPaginationParams, handleApiError } from "@/lib/api-helpers";

/**
 * GET /api/feed/guest
 * Guest feed with filter (all/following/favorites)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { limit, cursor } = extractPaginationParams(searchParams);
    const filter = searchParams.get("filter") || "all";

    // Map filter string to proto enum value
    let filterValue = FeedFilter.ALL;
    if (filter === "following") filterValue = FeedFilter.FOLLOWING;
    else if (filter === "favorites") filterValue = FeedFilter.FAVORITES;

    const response = await feedClient.listGuestFeed(
      {
        cursor,
        limit,
        filter: filterValue,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoPostsListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListGuestFeed");
  }
}
