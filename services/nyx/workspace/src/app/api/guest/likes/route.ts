import { NextRequest, NextResponse } from "next/server";
import { likeClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const response = await likeClient.likeCastPost(
      { postId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      likesCount: response.likesCount,
    });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return handleApiError(error, "LikeCastPost");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const postId = req.nextUrl.searchParams.get("post_id");

    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const response = await likeClient.unlikeCastPost(
      { postId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      likesCount: response.likesCount,
    });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return handleApiError(error, "UnlikeCastPost");
  }
}
