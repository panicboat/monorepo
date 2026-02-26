import { NextRequest, NextResponse } from "next/server";
import { offerClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await offerClient.getSchedules(
      { castUserId: "" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const schedules = (response.schedules || []).map((s) => ({
      date: s.date,
      start: s.startTime,
      end: s.endTime,
    }));

    return NextResponse.json({ schedules });
  } catch (error: unknown) {
    return handleApiError(error, "GetSchedules");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    const response = await offerClient.saveSchedules(
      { schedules: body.schedules },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const schedules = (response.schedules || []).map((s) => ({
      date: s.date,
      start: s.startTime,
      end: s.endTime,
    }));

    return NextResponse.json({ schedules });
  } catch (error: unknown) {
    return handleApiError(error, "SaveSchedules");
  }
}
