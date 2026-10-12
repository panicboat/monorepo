import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import { handleKarteApiError } from "@/modules/karte/lib/api-errors";
import { mapKarteEntryToView } from "@/modules/karte/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const status = req.nextUrl.searchParams.get("status") || "all";
    const res = await karteClient.listMyEntries({ limit, cursor, status }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map(mapKarteEntryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      counts: res.counts ? { total: res.counts.total, open: res.counts.open, closed: res.counts.closed } : { total: 0, open: 0, closed: 0 },
    });
  } catch (error: unknown) {
    return handleKarteApiError(error, "ListMyKarte");
  }
}
