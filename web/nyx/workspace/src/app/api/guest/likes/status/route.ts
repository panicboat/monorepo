import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const postIdsParam = req.nextUrl.searchParams.get("post_ids");

    if (!postIdsParam) {
      return NextResponse.json({ error: "post_ids is required" }, { status: 400 });
    }

    const postIds = postIdsParam.split(",").filter(Boolean);

    if (postIds.length === 0) {
      return NextResponse.json({ liked: {} });
    }

    const response = await socialClient.getPostLikeStatus(
      { postIds },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      liked: response.liked,
    });
  } catch (error: unknown) {
    console.error("GetPostLikeStatus Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
