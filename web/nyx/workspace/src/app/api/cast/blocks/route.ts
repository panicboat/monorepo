import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const response = await blockClient.listBlocked(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      users: response.users.map((user) => ({
        id: user.id,
        userType: user.userType,
        name: user.name,
        imageUrl: user.imageUrl,
        blockedAt: user.blockedAt,
      })),
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListBlocked Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { blockedId, blockedType } = body;

    if (!blockedId || !blockedType) {
      return NextResponse.json(
        { error: "blockedId and blockedType are required" },
        { status: 400 }
      );
    }

    const response = await blockClient.blockUser(
      { blockedId, blockedType, blockerType: "cast" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("BlockUser Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blockedId = req.nextUrl.searchParams.get("blocked_id");

    if (!blockedId) {
      return NextResponse.json(
        { error: "blocked_id is required" },
        { status: 400 }
      );
    }

    const response = await blockClient.unblockUser(
      { blockedId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("UnblockUser Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
