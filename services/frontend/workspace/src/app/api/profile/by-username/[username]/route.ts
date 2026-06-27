import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapProfileToView } from "@/modules/profile/lib/mappers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { username } = await params;
    const headers = buildGrpcHeaders(req);
    const res = await profileClient.getProfileByUsername({ username }, { headers });
    if (!res.profile) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetProfileByUsername");
  }
}
