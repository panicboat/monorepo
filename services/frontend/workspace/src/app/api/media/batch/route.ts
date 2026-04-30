import { NextRequest, NextResponse } from "next/server";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    if (ids.length === 0) {
      return NextResponse.json({ media: [] });
    }

    const response = await mediaClient.getMediaBatch(
      { ids },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      media: response.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        filename: m.filename,
        contentType: m.contentType,
        sizeBytes: Number(m.sizeBytes),
        createdAt: m.createdAt,
      })),
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetMediaBatch");
  }
}
