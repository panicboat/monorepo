import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";

export interface FollowRequest {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  requestedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    const response = await followClient.listPendingFollowRequests(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const requests: FollowRequest[] = (response.requests || []).map((r) => ({
      guestId: r.guestId,
      guestName: r.guestName,
      guestImageUrl: r.guestImageUrl,
      requestedAt: r.requestedAt,
    }));

    return NextResponse.json({
      requests,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListPendingFollowRequests");
  }
}
