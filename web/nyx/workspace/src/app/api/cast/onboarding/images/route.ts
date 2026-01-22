import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await castClient.saveCastImages(
      {
        profileImagePath: body.profileImagePath,
        galleryImages: body.galleryImages,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SaveCastImages Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
