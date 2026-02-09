import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export interface FollowRequest {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  requestedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const response = await followClient.listPendingFollowRequests(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const requests: FollowRequest[] = (response.requests || []).map((r) => ({
      guestId: r.guestId,
      guestName: r.guestName,
      guestImageUrl: r.guestImageUrl,
      requestedAt: r.requestedAt,
    }));

    return NextResponse.json({
      requests,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListPendingFollowRequests Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
