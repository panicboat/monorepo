import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { extractPaginationParams, handleApiError } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    const response = await commentClient.listReplies(
      { commentId: id, limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const replies = response.replies.map((reply) => ({
      id: reply.id,
      postId: reply.postId,
      parentId: reply.parentId,
      userId: reply.userId,
      content: reply.content,
      createdAt: reply.createdAt,
      author: reply.author
        ? {
            id: reply.author.id,
            name: reply.author.name,
            imageUrl: reply.author.imageUrl,
            userType: reply.author.userType,
          }
        : null,
      media: reply.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
      })),
      repliesCount: reply.repliesCount,
    }));

    return NextResponse.json({
      replies,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReplies");
  }
}
