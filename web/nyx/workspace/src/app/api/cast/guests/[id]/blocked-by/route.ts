import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;

    const response = await blockClient.listBlockedBy(
      { targetId: id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      blockers: (response.blockers || []).map((user) => ({
        id: user.id,
        userType: user.userType,
        name: user.name,
        imageUrl: user.imageUrl,
        blockedAt: user.blockedAt,
      })),
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListBlockedBy");
  }
}
