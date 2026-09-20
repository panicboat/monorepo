import { NextRequest, NextResponse } from "next/server";
import { scheduleClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapScheduleToView } from "@/modules/schedule/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const accountId = req.nextUrl.searchParams.get("accountId") || "";
    const fromDate = req.nextUrl.searchParams.get("fromDate") || "";
    const toDate = req.nextUrl.searchParams.get("toDate") || "";

    const res = await scheduleClient.listSchedules({ accountId, fromDate, toDate }, { headers });
    return NextResponse.json({ schedules: (res.schedules || []).map(mapScheduleToView) });
  } catch (error: unknown) {
    return handleApiError(error, "ListSchedules");
  }
}
