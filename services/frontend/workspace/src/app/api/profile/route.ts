import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapProfileToView, buildSaveProfileRequest } from "@/modules/profile/lib/mappers";
import type { SaveProfilePayload } from "@/modules/profile/types";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const res = await profileClient.getProfile({ accountId: "" }, { headers });
    if (!res.profile) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetProfile");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as SaveProfilePayload;
    const headers = buildGrpcHeaders(req);
    const res = await profileClient.saveProfile(buildSaveProfileRequest(body), { headers });
    if (!res.profile) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    return handleApiError(error, "SaveProfile");
  }
}
