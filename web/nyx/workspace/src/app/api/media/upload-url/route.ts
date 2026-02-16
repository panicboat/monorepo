import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType, mediaType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    const response = await mediaClient.getUploadUrl(
      { filename, contentType, mediaType: mediaType || 1 },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      uploadUrl: response.uploadUrl,
      mediaKey: response.mediaKey,
      mediaId: response.mediaId,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("[Media.GetUploadUrl] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
