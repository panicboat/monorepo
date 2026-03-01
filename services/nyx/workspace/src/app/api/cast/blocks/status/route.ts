import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const userIdsParam = req.nextUrl.searchParams.get("user_ids");

    if (!userIdsParam) {
      return NextResponse.json({ error: "user_ids is required" }, { status: 400 });
    }

    const userIds = userIdsParam.split(",").filter(Boolean);

    if (userIds.length === 0) {
      return NextResponse.json({ blocked: {} });
    }

    const response = await blockClient.getBlockStatus(
      { userIds },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      blocked: response.blocked,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetBlockStatus");
  }
}
