import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;

    const response = await trustClient.removeTagging(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    return handleApiError(error, "RemoveTagging");
  }
}
