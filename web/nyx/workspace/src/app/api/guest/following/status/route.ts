import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";

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

    const response = await followClient.getFollowStatus(
      { castUserIds: castIds },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      statuses: response.statuses,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetFollowStatus");
  }
}
