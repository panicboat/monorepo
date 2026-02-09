import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const castId = req.nextUrl.searchParams.get("cast_id") || "";
    const filterParam = req.nextUrl.searchParams.get("filter") || "";

    // Use "public" filter by default to force public timeline even for Cast users
    // Only override if specific filter is requested (e.g., "following")
    const filter = filterParam || "public";

    const response = await socialClient.listCastPosts(
      { castId, limit, cursor, filter },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Explicitly map to ensure all fields are serialized
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
        : null,
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
    console.error("ListPublicPosts Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
