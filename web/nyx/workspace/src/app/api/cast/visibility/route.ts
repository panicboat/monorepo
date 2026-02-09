import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { CastVisibility } from "@/stub/portfolio/v1/cast_service_pb";
import { buildGrpcHeaders } from "@/lib/request";

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const isPrivate = body.isPrivate === true;

    const visibility = isPrivate
      ? CastVisibility.PRIVATE
      : CastVisibility.PUBLIC;

    const response = await castClient.saveCastVisibility(
      { visibility },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      isPrivate: response.profile?.visibility === CastVisibility.PRIVATE,
    });
  } catch (error: any) {
    console.error("SaveCastVisibility Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
