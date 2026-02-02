import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { generateRequestId, HEADER_NAMES } from "@/lib/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const requestId = req.headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
    const headers: Record<string, string> = {
      [HEADER_NAMES.REQUEST_ID]: requestId,
    };

    const response = await socialClient.getCastPost({ id }, { headers });

    if (!response.post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post: response.post });
  } catch (error: unknown) {
    console.error("GetCastPost Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
