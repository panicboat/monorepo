import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

interface RouteParams {
  params: Promise<{ guestUserId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { guestUserId } = await params;

    if (!guestUserId) {
      return NextResponse.json({ error: "guestUserId is required" }, { status: 400 });
    }

    const response = await followClient.rejectFollow(
      { guestUserId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    return handleApiError(error, "RejectFollow");
  }
}
