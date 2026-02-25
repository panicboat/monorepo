import { NextRequest, NextResponse } from "next/server";
import { feedClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { extractPaginationParams, handleApiError } from "@/lib/api-helpers";

/**
 * GET /api/feed/cast
 * Cast's own feed for management (requires authentication)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { limit, cursor } = extractPaginationParams(searchParams);

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
    return handleApiError(error, "ListCastFeed");
  }
}
