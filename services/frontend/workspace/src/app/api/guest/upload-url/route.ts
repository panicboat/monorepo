import { NextRequest, NextResponse } from "next/server";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { filename, contentType } = await req.json();

    const response = await mediaClient.getUploadUrl(
      { filename, contentType },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Rewrite URL to point to frontend's /storage/upload endpoint (BFF pattern)
    const mediaKey = response.mediaKey;
    const frontendUploadUrl = `/storage/upload?key=${encodeURIComponent(mediaKey)}&content_type=${encodeURIComponent(contentType)}`;

    return NextResponse.json({
      url: frontendUploadUrl,
      key: mediaKey,
      mediaId: response.mediaId,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetUploadUrl");
  }
}
