import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const castIdsParam = req.nextUrl.searchParams.get("cast_ids");

    if (!castIdsParam) {
      return NextResponse.json({ error: "cast_ids is required" }, { status: 400 });
    }

    const castIds = castIdsParam.split(",").filter(Boolean);

    if (castIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    const response = await socialClient.getFollowStatus(
      { castIds },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      statuses: response.statuses,
    });
  } catch (error: unknown) {
    console.error("GetFollowStatus Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
