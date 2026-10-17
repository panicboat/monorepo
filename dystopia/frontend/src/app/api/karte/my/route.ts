import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapCountsToView, mapKarteToView } from "@/modules/karte/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listMyKartes({ limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      kartes: (res.kartes || []).map(mapKarteToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      counts: mapCountsToView(res.counts),
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyKartes");
  }
}
