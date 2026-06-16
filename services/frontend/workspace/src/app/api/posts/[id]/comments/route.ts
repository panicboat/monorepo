import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapCommentsListResponse } from "@/modules/post/lib/comment-mappers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await commentClient.listComments({ postId: id, limit, cursor }, { headers });
    return NextResponse.json(mapCommentsListResponse(res));
  } catch (error: unknown) {
    return handleApiError(error, "ListComments");
  }
}
