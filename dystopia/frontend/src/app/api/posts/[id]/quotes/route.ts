import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError, extractPaginationParams } from "@/lib/api-helpers";
import { mapPostsListResponse } from "@/modules/post/lib/post-mappers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = await buildGrpcHeaders(req);
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    const res = await postClient.listPostQuotes({ postId: id, limit, cursor }, { headers });
    return NextResponse.json(mapPostsListResponse(res));
  } catch (error: unknown) {
    return handleApiError(error, "ListPostQuotes");
  }
}
