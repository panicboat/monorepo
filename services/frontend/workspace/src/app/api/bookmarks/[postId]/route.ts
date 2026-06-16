import { NextRequest, NextResponse } from "next/server";
import { bookmarkClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { postId } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await bookmarkClient.bookmark({ postId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Bookmark");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { postId } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await bookmarkClient.unbookmark({ postId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unbookmark");
  }
}
