import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError, extractPaginationParams } from "@/lib/api-helpers";
import {
  mapPostToView,
  mapPostsListResponse,
  buildSavePostRequest,
} from "@/modules/post/lib/post-mappers";
import type { SavePostPayload } from "@/modules/post/lib/post-view";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);
    const authorId = req.nextUrl.searchParams.get("author_id") || "";
    const filter = req.nextUrl.searchParams.get("filter") || "";

    const res = await postClient.listPosts(
      { limit, cursor, authorId, filter },
      { headers }
    );
    return NextResponse.json(mapPostsListResponse(res));
  } catch (error: unknown) {
    return handleApiError(error, "ListPosts");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as SavePostPayload;
    const headers = buildGrpcHeaders(req.headers);
    const res = await postClient.savePost(buildSavePostRequest(body), { headers });
    if (!res.post) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ post: mapPostToView(res.post) });
  } catch (error: unknown) {
    return handleApiError(error, "CreatePost");
  }
}
