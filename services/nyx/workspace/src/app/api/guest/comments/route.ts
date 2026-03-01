import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { create } from "@bufbuild/protobuf";
import { CommentMediaSchema } from "@/stub/post/v1/comment_service_pb";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function GET(req: NextRequest) {
  try {
    const postId = req.nextUrl.searchParams.get("post_id") || "";
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const response = await commentClient.listComments(
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
            id: comment.author.userId,
            name: comment.author.name,
            imageUrl: comment.author.imageUrl,
            userType: comment.author.userType,
          }
        : null,
      media: comment.media.map((m) => ({
        id: m.id,
        mediaId: m.mediaId,
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
    return handleApiError(error, "ListComments");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { postId, content, parentId, media } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const hasContent = content && content.trim() !== "";
    const hasMedia = media && media.length > 0;
    if (!hasContent && !hasMedia) {
      return NextResponse.json({ error: "Content or media is required" }, { status: 400 });
    }

    // Create proper protobuf messages for media to ensure all fields are serialized correctly
    const mappedMedia = (media || []).map((m: { mediaId?: string; mediaType?: string }) =>
      create(CommentMediaSchema, {
        mediaId: m.mediaId || "",
        mediaType: m.mediaType || "image",
      })
    );

    const response = await commentClient.addComment(
      {
        postId,
        content: content || "",
        parentId: parentId || "",
        media: mappedMedia,
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
                  id: comment.author.userId,
                  name: comment.author.name,
                  imageUrl: comment.author.imageUrl,
                  userType: comment.author.userType,
                }
              : null,
            media: comment.media.map((m) => ({
              id: m.id,
              mediaId: m.mediaId,
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
    if (isConnectError(error)) {
      if (error.code === GrpcCode.INVALID_ARGUMENT) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === GrpcCode.NOT_FOUND) {
        return NextResponse.json({ error: "Post or parent comment not found" }, { status: 404 });
      }
    }
    return handleApiError(error, "AddComment");
  }
}
