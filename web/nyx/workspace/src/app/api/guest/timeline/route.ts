import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { mapProtoPostsListToJson } from "@/modules/post/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const castId = req.nextUrl.searchParams.get("cast_id") || "";
    const filterParam = req.nextUrl.searchParams.get("filter") || "";

    // Use "public" filter by default to force public timeline even for Cast users
    // Only override if specific filter is requested (e.g., "following")
    const filter = filterParam || "public";

    const response = await postClient.listCastPosts(
      { castId, limit, cursor, filter },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoPostsListToJson(response));
  } catch (error: unknown) {
    console.error("ListPublicPosts Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
