import { NextRequest, NextResponse } from "next/server";
import { likeClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await likeClient.likePost({ postId: id }, { headers });
    return NextResponse.json({ likesCount: res.likesCount });
  } catch (error: unknown) {
    return handleApiError(error, "LikePost");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await likeClient.unlikePost({ postId: id }, { headers });
    return NextResponse.json({ likesCount: res.likesCount });
  } catch (error: unknown) {
    return handleApiError(error, "UnlikePost");
  }
}
