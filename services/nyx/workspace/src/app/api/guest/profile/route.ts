import { NextRequest, NextResponse } from "next/server";
import { guestClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await guestClient.getGuestProfile(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const profile = response.profile
      ? {
          userId: response.profile.userId,
          name: response.profile.name,
          avatarUrl: response.profile.avatarUrl,
          avatarMediaId: response.profile.avatarMediaId,
          tagline: response.profile.tagline,
          bio: response.profile.bio,
          prefecture: response.profile.prefecture || "",
        }
      : null;

    return NextResponse.json({ profile });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "データが見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetGuestProfile");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    const response = await guestClient.saveGuestProfile(
      {
        name: body.name,
        avatarMediaId: body.avatarMediaId || "",
        tagline: body.tagline || "",
        bio: body.bio || "",
        prefecture: body.prefecture || "",
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const profile = response.profile
      ? {
          userId: response.profile.userId,
          name: response.profile.name,
          avatarUrl: response.profile.avatarUrl,
          avatarMediaId: response.profile.avatarMediaId,
          tagline: response.profile.tagline,
          bio: response.profile.bio,
          prefecture: response.profile.prefecture || "",
        }
      : null;

    return NextResponse.json({ profile });
  } catch (error: unknown) {
    return handleApiError(error, "SaveGuestProfile");
  }
}
