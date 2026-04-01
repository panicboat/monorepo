import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { CastStatusFilter } from "@/stub/portfolio/v1/cast_service_pb";
import { handleApiError } from "@/lib/api-helpers";

function parseStatusFilter(status: string | null): CastStatusFilter {
  switch (status?.toLowerCase()) {
    case "online":
      return CastStatusFilter.ONLINE;
    case "new":
      return CastStatusFilter.NEW;
    default:
      return CastStatusFilter.UNSPECIFIED;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefecture = searchParams.get("prefecture") || "";
    const areaId = searchParams.get("areaId") || "";
    const status = searchParams.get("status");
    const genreId = searchParams.get("genreId") || "";
    const query = searchParams.get("query") || "";

    const response = await castClient.getCastCount(
      {
        prefecture,
        areaId,
        statusFilter: parseStatusFilter(status),
        genreId,
        query,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ count: response.count || 0 });
  } catch (error: unknown) {
    return handleApiError(error, "GetCastCount");
  }
}
