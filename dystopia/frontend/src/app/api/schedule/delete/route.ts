import { NextRequest, NextResponse } from "next/server";
import { scheduleClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    await scheduleClient.deleteSchedule({ workDate: body?.workDate || "" }, { headers });
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "DeleteSchedule");
  }
}
