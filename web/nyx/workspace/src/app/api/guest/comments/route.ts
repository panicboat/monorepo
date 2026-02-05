import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const postId = req.nextUrl.searchParams.get("post_id") || "";
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);

    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const response = await socialClient.listComments(
      { postId, limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const comments = response.comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt,
      author: comment.author
        ? {
            id: comment.author.id,
            name: comment.author.name,
            imageUrl: comment.author.imageUrl,
            userType: comment.author.userType,
          }
        : null,
      media: comment.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
      })),
      repliesCount: comment.repliesCount,
    }));

    return NextResponse.json({
      comments,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    console.error("ListComments Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { postId, content, parentId, media } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    if (!content || content.trim() === "") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const response = await socialClient.addComment(
      {
        postId,
        content,
        parentId: parentId || "",
        media: media || [],
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const comment = response.comment;
    return NextResponse.json({
      comment: comment
        ? {
            id: comment.id,
            postId: comment.postId,
            parentId: comment.parentId,
            userId: comment.userId,
            content: comment.content,
            createdAt: comment.createdAt,
            author: comment.author
              ? {
                  id: comment.author.id,
                  name: comment.author.name,
                  imageUrl: comment.author.imageUrl,
                  userType: comment.author.userType,
                }
              : null,
            media: comment.media.map((m) => ({
              id: m.id,
              mediaType: m.mediaType,
              url: m.url,
              thumbnailUrl: m.thumbnailUrl,
            })),
            repliesCount: comment.repliesCount,
          }
        : null,
      commentsCount: response.commentsCount,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 3) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === 5) {
        return NextResponse.json({ error: "Post or parent comment not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("AddComment Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
