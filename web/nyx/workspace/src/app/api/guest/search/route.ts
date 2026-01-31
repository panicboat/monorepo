import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { mapCastProfileToFrontend } from "@/modules/portfolio/lib/cast/profile";
import {
  CastVisibility,
  CastStatusFilter,
} from "@/stub/portfolio/v1/service_pb";

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
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const response = await castClient.listCasts({
      visibilityFilter: CastVisibility.PUBLISHED,
      genreId,
      tag,
      statusFilter: parseStatusFilter(status),
      areaId,
      limit,
      offset,
    });

    const items = (response.items || []).map((item) => {
      const profile = item.profile
        ? mapCastProfileToFrontend(item.profile)
        : null;
      const plans = (item.plans || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration: p.durationMinutes,
      }));

      return {
        profile,
        plans,
      };
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error("ListCasts Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
