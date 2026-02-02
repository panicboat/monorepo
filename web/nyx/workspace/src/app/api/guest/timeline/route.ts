import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { generateRequestId, HEADER_NAMES } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const castId = req.nextUrl.searchParams.get("cast_id") || "";

    const requestId = req.headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
    const headers: Record<string, string> = {
      [HEADER_NAMES.REQUEST_ID]: requestId,
    };

    const response = await socialClient.listCastPosts(
      { castId, limit, cursor },
      { headers }
    );

    return NextResponse.json({
      posts: response.posts,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    console.error("ListPublicPosts Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
