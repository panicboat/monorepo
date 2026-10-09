import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await profileClient.deleteProfile({ profileId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.FAILED_PRECONDITION) {
      return NextResponse.json({ error: "有効なプロフィールは削除できません。先に無効にしてください" }, { status: 422 });
    }
    return handleApiError(error, "DeleteProfile");
  }
}
