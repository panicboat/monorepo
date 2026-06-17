import { NextRequest, NextResponse } from "next/server";
import { footprintsClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapFootprintToView } from "@/modules/footprints/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await footprintsClient.listFootprints(
      { limit, cursor },
      { headers }
    );
    return NextResponse.json({
      footprints: (res.footprints || []).map(mapFootprintToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListFootprints");
  }
}
