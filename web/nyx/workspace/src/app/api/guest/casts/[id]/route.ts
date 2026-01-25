import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { mapCastProfileToFrontend } from "@/modules/portfolio/lib/cast/profile";
import { CastVisibility } from "@/stub/portfolio/v1/service_pb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await castClient.getCastProfile({ userId: id });

    if (!response.profile) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Only return published profiles to guests
    if (response.profile.visibility !== CastVisibility.PUBLISHED) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

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
