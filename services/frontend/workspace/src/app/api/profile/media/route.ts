import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProfileToView } from "@/modules/profile/lib/mappers";
import type { SaveProfileMediaPayload } from "@/modules/profile/types";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as SaveProfileMediaPayload;
    const headers = buildGrpcHeaders(req);
    const res = await profileClient.saveProfileMedia(
      { avatarMediaId: body.avatarMediaId || "", coverMediaId: body.coverMediaId || "" },
      { headers }
    );
    if (!res.profile) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    return handleApiError(error, "SaveProfileMedia");
  }
}
