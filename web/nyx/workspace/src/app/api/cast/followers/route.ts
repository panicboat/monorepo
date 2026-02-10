import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export interface Follower {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  followedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const response = await followClient.listFollowers(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const followers: Follower[] = (response.followers || []).map((f) => ({
      guestId: f.guestId,
      guestName: f.guestName,
      guestImageUrl: f.guestImageUrl,
      followedAt: f.followedAt,
    }));

    return NextResponse.json({
      followers,
      total: response.total,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListFollowers Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
