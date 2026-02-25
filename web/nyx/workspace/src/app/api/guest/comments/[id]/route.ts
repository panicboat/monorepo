import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;

    const response = await commentClient.deleteComment(
      { commentId: id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      commentsCount: response.commentsCount,
    });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "Comment not found or unauthorized" }, { status: 404 });
    }
    return handleApiError(error, "DeleteComment");
  }
}
