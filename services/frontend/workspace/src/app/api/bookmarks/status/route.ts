import { NextRequest, NextResponse } from "next/server";
import { bookmarkClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const postIds: string[] = Array.isArray(body?.postIds) ? body.postIds : [];
    if (postIds.length === 0) {
      return NextResponse.json({ bookmarked: {} });
    }
    const res = await bookmarkClient.getBookmarkStatus({ postIds }, { headers });
    return NextResponse.json({ bookmarked: res.bookmarked || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetBookmarkStatus");
  }
}
