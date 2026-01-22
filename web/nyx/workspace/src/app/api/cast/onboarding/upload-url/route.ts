import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType } = await req.json();

    const response = await castClient.getUploadUrl(
      { filename, contentType },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Rewrite URL to point to nyx's /storage/upload endpoint (BFF pattern)
    const key = response.key;
    const nyxUploadUrl = `/storage/upload?key=${encodeURIComponent(key)}&content_type=${encodeURIComponent(contentType)}`;

    return NextResponse.json({
      url: nyxUploadUrl,
      key: response.key,
    });
  } catch (error: any) {
    console.error("GetUploadUrl Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
