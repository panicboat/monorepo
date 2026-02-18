import { NextRequest, NextResponse } from "next/server";
import { mediaClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType } = await req.json();

    const response = await mediaClient.getUploadUrl(
      { filename, contentType },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Rewrite URL to point to nyx's /storage/upload endpoint (BFF pattern)
    const mediaKey = response.mediaKey;
    const nyxUploadUrl = `/storage/upload?key=${encodeURIComponent(mediaKey)}&content_type=${encodeURIComponent(contentType)}`;

    return NextResponse.json({
      url: nyxUploadUrl,
      key: mediaKey,
      mediaId: response.mediaId,
    });
  } catch (error: any) {
    console.error("GetUploadUrl Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
