import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { summaryToView } from "@/modules/profile/lib/mappers";
import { mapScheduleToView } from "@/modules/schedule/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const params = req.nextUrl.searchParams;
    const res = await discoveryClient.searchSchedules(
      {
        workDate: params.get("date") || "",
        prefecture: params.get("prefecture") || "",
        area: params.get("area") || "",
        industry: params.get("industry") || "",
        timeBand: params.get("timeBand") || "",
        followingOnly: params.get("followingOnly") === "true",
        query: params.get("q") || "",
        limit: Number(params.get("limit") || "20"),
        cursor: params.get("cursor") || "",
      },
      { headers }
    );
    return NextResponse.json({
      // FALLBACK: Skip a result the server sent without its schedule or profile.
      results: (res.results || []).flatMap((r) =>
        r.schedule && r.profile
          ? [{ schedule: mapScheduleToView(r.schedule), profile: summaryToView(r.profile), prefecture: r.prefecture, area: r.area, note: r.note }]
          : []
      ),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "SearchSchedules");
  }
}
