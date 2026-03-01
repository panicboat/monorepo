import { NextRequest, NextResponse } from "next/server";
import { offerClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

interface ScheduleInput {
  date: string;
  start: string;
  end: string;
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    // Map frontend format to proto format
    const protoSchedules = (body.schedules || []).map((s: ScheduleInput) => ({
      date: s.date,
      startTime: s.start,
      endTime: s.end,
    }));

    const response = await offerClient.saveSchedules(
      { schedules: protoSchedules },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Map to same format as GET /api/cast/onboarding/profile
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
