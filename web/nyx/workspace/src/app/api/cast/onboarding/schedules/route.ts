import { NextRequest, NextResponse } from "next/server";
import { offerClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

interface ScheduleInput {
  date: string;
  start: string;
  end: string;
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("SaveSchedules Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
