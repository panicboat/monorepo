import { NextRequest, NextResponse } from "next/server";
import { offerClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const response = await offerClient.getPlans(
      { castId: "" },
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
  } catch (error: unknown) {
    return handleApiError(error, "GetPlans");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();

    const response = await offerClient.savePlans(
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
  } catch (error: unknown) {
    return handleApiError(error, "SavePlans");
  }
}
