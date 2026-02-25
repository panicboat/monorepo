import { NextRequest, NextResponse } from "next/server";
import { castClient, offerClient, followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapCastProfileToFrontend } from "@/modules/portfolio/lib/cast/profile";
import { FollowStatus } from "@/stub/relationship/v1/follow_service_pb";
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

    // 2. Determine if viewer can see details (plans, schedules, etc.)
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

    // 3. Fetch plans and schedules only if viewer can see details
    let plans: { id: string; name: string; price: number; duration: number; isRecommended: boolean }[] = [];
    let schedules: { date: string; start: string; end: string }[] = [];

    if (canViewDetails) {
      const [plansResponse, schedulesResponse] = await Promise.all([
        offerClient.getPlans({ castId }, headers),
        offerClient.getSchedules({ castId }, headers),
      ]);

      plans = (plansResponse.plans || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration: p.durationMinutes,
        isRecommended: p.isRecommended || false,
      }));

      schedules = (schedulesResponse.schedules || []).map((s) => ({
        date: s.date,
        start: s.startTime,
        end: s.endTime,
      }));
    }

    return NextResponse.json({
      profile,
      plans,
      schedules,
      canViewDetails,
    });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return handleApiError(error, "GetCastProfile");
  }
}
