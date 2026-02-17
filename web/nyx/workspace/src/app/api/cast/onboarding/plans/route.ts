import { NextRequest, NextResponse } from "next/server";
import { offerClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

interface PlanInput {
  id?: string;
  name: string;
  price: number;
  duration: number;
  isRecommended?: boolean;
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Map frontend format to proto format
    const protoPlans = (body.plans || []).map((p: PlanInput) => ({
      id: p.id || "",
      name: p.name,
      price: p.price,
      durationMinutes: p.duration,
      isRecommended: p.isRecommended || false,
    }));

    const response = await offerClient.savePlans(
      { plans: protoPlans },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Map to same format as GET /api/cast/onboarding/profile
    const plans = (response.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      duration: p.durationMinutes,
      isRecommended: p.isRecommended || false,
    }));

    return NextResponse.json({ plans });
  } catch (error: unknown) {
    console.error("SavePlans Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
