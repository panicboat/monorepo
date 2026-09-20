import { NextRequest, NextResponse } from "next/server";
import { scheduleClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapScheduleToView } from "@/modules/schedule/lib/mappers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    const res = await scheduleClient.saveSchedule(
      {
        workDate: body?.workDate || "",
        startTime: body?.startTime || "",
        endTime: body?.endTime || "",
      },
      { headers }
    );
    return NextResponse.json({ schedule: res.schedule ? mapScheduleToView(res.schedule) : null });
  } catch (error: unknown) {
    return handleApiError(error, "SaveSchedule");
  }
}
