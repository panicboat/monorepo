import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const revieweeId = req.nextUrl.searchParams.get("reviewee_id");
    const status = req.nextUrl.searchParams.get("status");

    if (!revieweeId) {
      return NextResponse.json(
        { error: "reviewee_id is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.listReviews(
      { revieweeId, status: status || undefined },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const reviews = (response.reviews || []).map((r) => ({
      id: r.id,
      reviewerId: r.reviewerId,
      revieweeId: r.revieweeId,
      content: r.content,
      score: r.score,
      status: r.status,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListReviews Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
