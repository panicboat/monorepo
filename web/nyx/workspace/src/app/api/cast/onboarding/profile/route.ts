import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await castClient.getCastProfile(
      { userId: "" }, // Server infers from token if empty
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Convert to JSON-friendly format if needed, but response is usually plain object in Connect-Web?
    // Actually ConnectRPC returns message object. NextResponse.json handles it.
    // But bigint might be issue? CastProfile IDs are strings in Proto now.
    return NextResponse.json(response);
  } catch (error: any) {
    if (error instanceof ConnectError) {
         if (error.code === 5) { // NotFound
             // It's expected during onboarding, so just return 404 without error log
             return NextResponse.json({ error: "Not Found" }, { status: 404 });
         }
    }
    console.error("GetCastProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("API Route /api/cast/onboarding/profile [POST] Received Body:", body);

    const response = await castClient.createCastProfile(
      {
        name: body.name,
        bio: body.bio,
        tagline: body.tagline,
        serviceCategory: body.serviceCategory,
        locationType: body.locationType,
        area: body.area,
        defaultScheduleStart: body.defaultScheduleStart,
        defaultScheduleEnd: body.defaultScheduleEnd,
        imagePath: body.imagePath,
        socialLinks: body.socialLinks ? {
          x: body.socialLinks.x || "",
          instagram: body.socialLinks.instagram || "",
          tiktok: body.socialLinks.tiktok || "",
          cityheaven: body.socialLinks.cityheaven || "",
          litlink: body.socialLinks.litlink || "",
          others: body.socialLinks.others || [],
        } : undefined,
        age: body.age || 0,
        height: body.height || 0,
        bloodType: body.bloodType || "",
        threeSizes: body.threeSizes ? {
          bust: body.threeSizes.bust || 0,
          waist: body.threeSizes.waist || 0,
          hip: body.threeSizes.hip || 0,
          cup: body.threeSizes.cup || "",
        } : undefined,
        tags: body.tags || [],
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("CreateCastProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("API Route /api/cast/onboarding/profile [PUT] Received Body:", body);

    const response = await castClient.saveCastProfile(
      {
        name: body.name,
        bio: body.bio,
        tagline: body.tagline,
        serviceCategory: body.serviceCategory,
        locationType: body.locationType,
        area: body.area,
        defaultScheduleStart: body.defaultScheduleStart,
        defaultScheduleEnd: body.defaultScheduleEnd,
        imagePath: body.imagePath,
        socialLinks: body.socialLinks ? {
          x: body.socialLinks.x || "",
          instagram: body.socialLinks.instagram || "",
          tiktok: body.socialLinks.tiktok || "",
          cityheaven: body.socialLinks.cityheaven || "",
          litlink: body.socialLinks.litlink || "",
          others: body.socialLinks.others || [],
        } : undefined,
        age: body.age || 0,
        height: body.height || 0,
        bloodType: body.bloodType || "",
        threeSizes: body.threeSizes ? {
          bust: body.threeSizes.bust || 0,
          waist: body.threeSizes.waist || 0,
          hip: body.threeSizes.hip || 0,
          cup: body.threeSizes.cup || "",
        } : undefined,
        tags: body.tags || [],
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SaveCastProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
