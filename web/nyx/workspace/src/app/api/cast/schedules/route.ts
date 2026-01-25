import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await castClient.getCastProfile(
      { userId: "" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const schedules = (response.schedules || []).map((s) => ({
      date: s.date,
      start: s.startTime,
      end: s.endTime,
      planId: s.planId,
    }));

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error("GetCastSchedules Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await castClient.saveCastSchedules(
      { schedules: body.schedules },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Map to same format as GET
    const schedules = (response.schedules || []).map((s) => ({
      date: s.date,
      start: s.startTime,
      end: s.endTime,
      planId: s.planId,
    }));

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error("SaveCastSchedules Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
