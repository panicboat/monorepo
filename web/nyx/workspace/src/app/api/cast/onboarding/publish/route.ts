import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { CastVisibility } from "@/lib/portfolio/v1/service_pb";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Publish sets visibility to PUBLISHED
    const response = await castClient.saveCastProfile(
      {
        visibility: CastVisibility.PUBLISHED,
      },
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SaveCastProfile (publish) Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
