import { NextRequest, NextResponse } from "next/server";
import { footprintsClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const body = await req.json();
    const visitedAccountId = body?.visitedAccountId || "";

    await footprintsClient.recordVisit({ visitedAccountId }, { headers });
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "RecordVisit");
  }
}
