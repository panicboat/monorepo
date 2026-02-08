import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { CastVisibility } from "@/stub/portfolio/v1/service_pb";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Complete onboarding with public visibility
    const response = await castClient.saveCastVisibility(
      { visibility: CastVisibility.PUBLIC },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SaveCastVisibility Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
