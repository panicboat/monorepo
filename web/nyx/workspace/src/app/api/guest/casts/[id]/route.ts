import { NextRequest, NextResponse } from "next/server";
import { castClient, offerClient, followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { ConnectError } from "@connectrpc/connect";
import { mapCastProfileToFrontend } from "@/modules/portfolio/lib/cast/profile";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
import { CastVisibility } from "@/stub/portfolio/v1/cast_service_pb";

// UUID v4 format check
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const isUuid = UUID_REGEX.test(id);
    const headers = { headers: buildGrpcHeaders(req.headers) };

    // 1. Get profile from Portfolio
    const profileResponse = isUuid
      ? await castClient.getCastProfile({ userId: id }, headers)
      : await castClient.getCastProfileBySlug({ slug: id }, headers);

    if (!profileResponse.profile) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const castId = profileResponse.profile.id;
    const profile = mapCastProfileToFrontend(profileResponse.profile);

    // 2. Parallel fetch: plans, schedules from Offer
    const [plansResponse, schedulesResponse] = await Promise.all([
      offerClient.getPlans({ castId }, headers),
      offerClient.getSchedules({ castId }, headers),
    ]);

    // 3. Check if cast is private and if viewer is an approved follower
    let canViewDetails = true;
    if (profileResponse.profile.visibility === CastVisibility.PRIVATE) {
      try {
        const followResponse = await followClient.getFollowStatus(
          { castIds: [castId] },
          headers
        );
        const status = followResponse.statuses[castId];
        canViewDetails = status === FollowStatus.APPROVED;
      } catch {
        canViewDetails = false;
      }
    }

    const plans = canViewDetails
      ? (plansResponse.plans || []).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          duration: p.durationMinutes,
          isRecommended: p.isRecommended || false,
        }))
      : [];

    const schedules = canViewDetails
      ? (schedulesResponse.schedules || []).map((s) => ({
          date: s.date,
          start: s.startTime,
          end: s.endTime,
        }))
      : [];

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
