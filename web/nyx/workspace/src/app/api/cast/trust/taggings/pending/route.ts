import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const response = await trustClient.listPendingTaggings(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const taggings = (response.taggings || []).map((t) => ({
      id: t.id,
      tagName: t.tagName,
      taggerId: t.taggerId,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({
      taggings,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 7) {
        return NextResponse.json(
          { error: "Cast role required" },
          { status: 403 }
        );
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("ListPendingTaggings Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
