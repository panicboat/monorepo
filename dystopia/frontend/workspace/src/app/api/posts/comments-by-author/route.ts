import { NextRequest, NextResponse } from "next/server";
import { commentClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapCommentToView } from "@/modules/post/lib/comment-mappers";
import { mapPostToView } from "@/modules/post/lib/post-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const authorId = req.nextUrl.searchParams.get("author_id") || "";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await commentClient.listCommentsByAuthor(
      { authorId, limit, cursor },
      { headers }
    );

    const postsByIdMap: Record<string, ReturnType<typeof mapPostToView>> = {};
    for (const [pid, post] of Object.entries(res.postsById || {})) {
      postsByIdMap[pid] = mapPostToView(post);
    }

    return NextResponse.json({
      comments: (res.comments || []).map(mapCommentToView),
      postsById: postsByIdMap,
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListCommentsByAuthor");
  }
}
