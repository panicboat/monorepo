import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
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

    const response = await castClient.getCastProfile(
      { userId: "" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapCastProfileToFrontend(response.profile!));
  } catch (error: any) {
    if (error instanceof ConnectError && error.code === 5) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const headers = buildGrpcHeaders(req.headers);

    // Save profile
    const profileResponse = await castClient.saveCastProfile(
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

    return NextResponse.json(profileResponse);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
