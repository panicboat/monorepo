import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { commentId } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await commentClient.deleteComment({ commentId }, { headers });
    return NextResponse.json({ commentsCount: res.commentsCount });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteComment");
  }
}
