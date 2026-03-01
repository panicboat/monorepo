import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const response = await postClient.getCastPost(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    if (!response.post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = response.post;
    // Explicitly map to ensure all fields are serialized
    const mappedPost = {
      id: post.id,
      castId: post.castUserId,
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
            id: post.author.userId,
            name: post.author.name,
            imageUrl: post.author.imageUrl,
          }
        : null,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      visibility: post.visibility,
      hashtags: post.hashtags,
      liked: post.liked,
    };

    return NextResponse.json({ post: mappedPost });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return handleApiError(error, "GetCastPost");
  }
}
