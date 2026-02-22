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

    if (!revieweeId) {
      return NextResponse.json(
        { error: "reviewee_id is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.getReviewStats(
      { revieweeId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const stats = response.stats
      ? {
          averageScore: response.stats.averageScore,
          totalReviews: response.stats.totalReviews,
          approvalRate: response.stats.approvalRate,
        }
      : null;

    return NextResponse.json({ stats });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GetReviewStats Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
