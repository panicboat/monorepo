import { NextRequest, NextResponse } from "next/server";
import { castClient, offerClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";
import {
  mapCastProfileToFrontend,
  buildSaveProfileRequest,
} from "@/modules/portfolio/lib/cast/profile";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    if (error instanceof ConnectError && error.code === 5) {
      // NotFound is expected during onboarding
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    console.error("GetCastProfile Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const headers = buildGrpcHeaders(req.headers);

    // Save profile (upsert)
    const response = await castClient.saveCastProfile(
      buildSaveProfileRequest(body),
      { headers }
    );

    // Save images if provided
    if (body.imagePath || (body.images && body.images.length > 0)) {
      await castClient.saveCastImages(
        {
          profileImagePath: body.imagePath || "",
          galleryImages: body.images || [],
        },
        { headers }
      );
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SaveCastProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
