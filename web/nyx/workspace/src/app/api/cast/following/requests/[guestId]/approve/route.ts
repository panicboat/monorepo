import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

interface RouteParams {
  params: Promise<{ guestId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { guestId } = await params;

    if (!guestId) {
      return NextResponse.json({ error: "guestId is required" }, { status: 400 });
    }

    const response = await followClient.approveFollow(
      { guestId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ApproveFollow");
  }
}
