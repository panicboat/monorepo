import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { revieweeId, content, score } = await req.json();
    if (!revieweeId || score === undefined) {
      return NextResponse.json(
        { error: "revieweeId and score are required" },
        { status: 400 }
      );
    }

    const response = await trustClient.createReview(
      { revieweeId, content, score },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success, id: response.id });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 3) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("CreateReview Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
