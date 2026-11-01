import { NextRequest, NextResponse } from "next/server";
import { reportClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { targetType, targetId, reason, note } = await req.json();
    const headers = await buildGrpcHeaders(req);
    await reportClient.createReport({ targetType, targetId, reason, note }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "CreateReport");
  }
}
