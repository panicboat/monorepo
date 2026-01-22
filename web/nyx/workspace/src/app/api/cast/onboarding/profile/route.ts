import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await castClient.getCastProfile(
      { userId: "" }, // Server infers from token if empty
      {
        headers: {
          Authorization: authHeader,
        },
      }
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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
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
      },
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("CreateCastProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
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
      },
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SaveCastProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
