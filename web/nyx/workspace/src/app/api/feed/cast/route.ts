import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { feedClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

/**
 * GET /api/feed/cast
 * Cast's own feed for management (requires authentication)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const response = await feedClient.listCastFeed(
      {
        cursor,
        limit,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Map proto response to API response
    const posts = response.posts.map((post) => ({
      id: post.id,
      castId: post.castId,
      content: post.content,
      media: post.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
      })),
      createdAt: post.createdAt,
      author: post.author
        ? {
            id: post.author.id,
            name: post.author.name,
            imageUrl: post.author.imageUrl,
          }
        : undefined,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      visibility: post.visibility,
      hashtags: post.hashtags,
      liked: post.liked,
    }));

    return NextResponse.json({
      posts,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("[Feed.ListCastFeed] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
