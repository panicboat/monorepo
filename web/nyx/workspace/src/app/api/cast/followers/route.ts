import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";

export interface Follower {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  followedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    const response = await followClient.listFollowers(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const followers: Follower[] = (response.followers || []).map((f) => ({
      guestId: f.guestId,
      guestName: f.guestName,
      guestImageUrl: f.guestImageUrl,
      followedAt: f.followedAt,
    }));

    return NextResponse.json({
      followers,
      total: response.total,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListFollowers");
  }
}
