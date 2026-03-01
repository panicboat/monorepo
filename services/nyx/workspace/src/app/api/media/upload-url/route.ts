import { NextRequest, NextResponse } from "next/server";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { filename, contentType, mediaType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    // Convert mediaType to number (supports both string "IMAGE"/"VIDEO" and number 1/2)
    // FALLBACK: Defaults to IMAGE (1) when mediaType is not specified
    let mediaTypeNum = 1;
    if (typeof mediaType === "number") {
      mediaTypeNum = mediaType;
    } else if (typeof mediaType === "string") {
      mediaTypeNum = mediaType.toUpperCase() === "VIDEO" ? 2 : 1;
    }

    const response = await mediaClient.getUploadUrl(
      { filename, contentType, mediaType: mediaTypeNum },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      uploadUrl: response.uploadUrl,
      mediaKey: response.mediaKey,
      mediaId: response.mediaId,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetUploadUrl");
  }
}
