import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await castClient.getCastProfile(
      { userId: "" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const plans = (response.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price ?? 0,
      duration: p.durationMinutes,
      isRecommended: p.isRecommended || false,
    }));

    return NextResponse.json({ plans });
  } catch (error: any) {
    console.error("GetCastPlans Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await castClient.saveCastPlans(
      { plans: body.plans },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const plans = (response.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price ?? 0,
      duration: p.durationMinutes,
      isRecommended: p.isRecommended || false,
    }));

    return NextResponse.json({ plans });
  } catch (error: any) {
    console.error("SaveCastPlans Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
