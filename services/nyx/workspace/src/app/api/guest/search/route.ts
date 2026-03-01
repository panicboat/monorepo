import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { mapCastProfileToFrontend } from "@/modules/portfolio/lib/cast/profile";
import {
  CastVisibility,
  CastStatusFilter,
} from "@/stub/portfolio/v1/cast_service_pb";
import { extractPaginationParams, handleApiError } from "@/lib/api-helpers";

function parseStatusFilter(status: string | null): CastStatusFilter {
  switch (status?.toLowerCase()) {
    case "online":
      return CastStatusFilter.ONLINE;
    case "new":
      return CastStatusFilter.NEW;
    case "ranking":
      return CastStatusFilter.RANKING;
    default:
      return CastStatusFilter.UNSPECIFIED;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const genreId = searchParams.get("genreId") || "";
    const tag = searchParams.get("tag") || "";
    const status = searchParams.get("status");
    const areaId = searchParams.get("areaId") || "";
    const query = searchParams.get("query") || "";
    const { limit, cursor } = extractPaginationParams(searchParams, 50);

    const response = await castClient.listCasts(
      {
        visibilityFilter: CastVisibility.UNSPECIFIED, // Show all registered casts (both public and private)
        genreId,
        tag,
        statusFilter: parseStatusFilter(status),
        areaId,
        query,
        limit,
        cursor,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // FALLBACK: Returns empty array when response items is missing
    const items = (response.items || []).map((item) => {
      // FALLBACK: Returns null when profile is missing
      const profile = item.profile
        ? mapCastProfileToFrontend(item.profile)
        : null;
      const plans = (item.plans || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration: p.durationMinutes,
        isRecommended: p.isRecommended || false,
      }));

      return {
        profile,
        plans,
      };
    });

    return NextResponse.json({
      items,
      // FALLBACK: Returns empty/false when pagination fields are missing
      nextCursor: response.nextCursor || "",
      hasMore: response.hasMore || false,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListCasts");
  }
}
