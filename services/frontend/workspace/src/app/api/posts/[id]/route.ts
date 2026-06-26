import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapPostToView, buildSavePostRequest } from "@/modules/post/lib/post-mappers";
import type { SavePostPayload } from "@/modules/post/lib/post-view";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req);
    const res = await postClient.getPost({ id }, { headers });
    if (!res.post) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return NextResponse.json({ post: mapPostToView(res.post) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetPost");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const body = (await req.json()) as SavePostPayload;
    const headers = buildGrpcHeaders(req);
    const res = await postClient.savePost(buildSavePostRequest({ ...body, id }), { headers });
    if (!res.post) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ post: mapPostToView(res.post) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "UpdatePost");
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
    const headers = buildGrpcHeaders(req);
    await postClient.deletePost({ id }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "DeletePost");
  }
}
