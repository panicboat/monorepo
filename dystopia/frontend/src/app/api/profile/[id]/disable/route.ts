import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapProfileToView } from "@/modules/profile/lib/mappers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const res = await profileClient.disableProfile({ profileId: id }, { headers: await buildGrpcHeaders(req) });
    if (!res.profile) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.FAILED_PRECONDITION) {
      return NextResponse.json({ error: "有効なプロフィールが他に無いため、無効にできません" }, { status: 422 });
    }
    return handleApiError(error, "DisableProfile");
  }
}
