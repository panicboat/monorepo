import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";
import { mapProtoPostsListToJson } from "@/modules/post/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    const response = await postClient.listCastPosts(
      { castId: "", limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoPostsListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListCastPosts");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    const response = await postClient.saveCastPost(
      {
        id: body.id || "",
        content: body.content,
        media: body.media || [],
        visibility: body.visibility || "public",
        hashtags: body.hashtags || [],
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ post: response.post });
  } catch (error: unknown) {
    return handleApiError(error, "SaveCastPost");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    await postClient.deleteCastPost(
      { id: body.id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteCastPost");
  }
}
