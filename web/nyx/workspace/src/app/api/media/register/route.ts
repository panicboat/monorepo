import { NextRequest, NextResponse } from "next/server";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const {
      mediaId,
      mediaKey,
      mediaType,
      filename,
      contentType,
      sizeBytes,
      thumbnailKey,
    } = await req.json();

    if (!mediaId || !mediaKey) {
      return NextResponse.json(
        { error: "mediaId and mediaKey are required" },
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

    const response = await mediaClient.registerMedia(
      {
        mediaId,
        mediaKey,
        mediaType: mediaTypeNum,
        // FALLBACK: Returns empty/default values when optional fields are missing
        filename: filename || "",
        contentType: contentType || "",
        sizeBytes: BigInt(sizeBytes || 0),
        thumbnailKey: thumbnailKey || "",
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      media: response.media
        ? {
            id: response.media.id,
            mediaType: response.media.mediaType,
            url: response.media.url,
            thumbnailUrl: response.media.thumbnailUrl,
            filename: response.media.filename,
            contentType: response.media.contentType,
            sizeBytes: Number(response.media.sizeBytes),
            createdAt: response.media.createdAt,
          }
        : null,
    });
  } catch (error: unknown) {
    return handleApiError(error, "RegisterMedia");
  }
}
