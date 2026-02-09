import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);

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
    console.error("ListReplies Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
