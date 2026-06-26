import { NextRequest, NextResponse } from "next/server";
import { socialBlockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const body = await req.json();
    const targetAccountIds: string[] = Array.isArray(body?.targetAccountIds) ? body.targetAccountIds : [];
    if (targetAccountIds.length === 0) {
      return NextResponse.json({ blocked: {} });
    }
    const res = await socialBlockClient.getBlockStatus({ targetAccountIds }, { headers });
    return NextResponse.json({ blocked: res.blocked || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetBlockStatus");
  }
}
