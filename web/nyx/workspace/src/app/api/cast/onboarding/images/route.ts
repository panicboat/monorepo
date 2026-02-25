import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    const request: Record<string, any> = {
      profileMediaId: body.profileMediaId,
      galleryMediaIds: body.galleryMediaIds || [],
    };
    if (body.avatarMediaId !== undefined) {
      request.avatarMediaId = body.avatarMediaId;
    }

    const response = await castClient.saveCastImages(
      request,
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    return handleApiError(error, "SaveCastImages");
  }
}
