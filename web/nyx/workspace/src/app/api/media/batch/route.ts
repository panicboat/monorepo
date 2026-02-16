import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("[Media.GetMediaBatch] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
