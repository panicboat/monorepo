import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { ConnectError } from "@connectrpc/connect";
import { mapCastProfileToFrontend } from "@/modules/portfolio/lib/cast/profile";

// UUID v4 format check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // If id matches UUID format, lookup by userId/castId; otherwise lookup by handle
    // The backend will try user_id first, then cast_id
    const isUuid = UUID_REGEX.test(id);
    const headers = { headers: buildGrpcHeaders(req.headers) };
    const response = isUuid
      ? await castClient.getCastProfile({ userId: id }, headers)
      : await castClient.getCastProfileByHandle({ handle: id }, headers);

    if (!response.profile) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Backend already checks registered_at for guest access
    const profile = mapCastProfileToFrontend(response.profile);
    const plans = (response.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      duration: p.durationMinutes,
    }));
    const schedules = (response.schedules || []).map((s) => ({
      date: s.date,
      start: s.startTime,
      end: s.endTime,
      planId: s.planId,
    }));

    return NextResponse.json({
      profile,
      plans,
      schedules,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 5) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    console.error("GetCastProfile Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
