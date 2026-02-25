import { NextRequest, NextResponse } from "next/server";
import { castClient, offerClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import {
  mapCastProfileToFrontend,
  buildSaveProfileRequest,
} from "@/modules/portfolio/lib/cast/profile";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);

    // Fetch profile and offer data in parallel
    const [profileResponse, plansResponse, schedulesResponse] =
      await Promise.all([
        castClient.getCastProfile({ userId: "" }, { headers }),
        offerClient.getPlans({ castId: "" }, { headers }),
        offerClient.getSchedules({ castId: "", startDate: "", endDate: "" }, { headers }),
      ]);

    const profile = mapCastProfileToFrontend(profileResponse.profile!);
    const plans = (plansResponse.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      duration: p.durationMinutes,
      isRecommended: p.isRecommended || false,
    }));
    const schedules = (schedulesResponse.schedules || []).map((s) => ({
      date: s.date,
      start: s.startTime,
      end: s.endTime,
    }));

    return NextResponse.json({ profile, plans, schedules });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      // NotFound is expected during onboarding
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return handleApiError(error, "GetCastProfile");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const headers = buildGrpcHeaders(req.headers);

    // Save profile (upsert)
    const response = await castClient.saveCastProfile(
      buildSaveProfileRequest(body),
      { headers }
    );

    // Save images if provided
    if (body.profileMediaId || (body.galleryMediaIds && body.galleryMediaIds.length > 0)) {
      await castClient.saveCastImages(
        {
          profileMediaId: body.profileMediaId || "",
          galleryMediaIds: body.galleryMediaIds || [],
        },
        { headers }
      );
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    return handleApiError(error, "SaveCastProfile");
  }
}
