import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await trustClient.removeTagging(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("RemoveTagging Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
