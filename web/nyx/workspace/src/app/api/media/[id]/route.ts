import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await mediaClient.getMedia(
      { id },
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
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("[Media.GetMedia] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await mediaClient.deleteMedia(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("[Media.DeleteMedia] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
