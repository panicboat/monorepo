import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
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

    const response = await blockClient.listBlockedBy(
      { targetId: id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      blockers: (response.blockers || []).map((user) => ({
        id: user.id,
        userType: user.userType,
        name: user.name,
        imageUrl: user.imageUrl,
        blockedAt: user.blockedAt,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListBlockedBy Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
