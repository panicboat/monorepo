import { NextRequest, NextResponse } from "next/server";
import { followClient, castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";

interface FollowingCast {
  id: string;
  name: string;
  imageUrl: string;
  area: string;
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams, 100);

    const response = await followClient.listFollowing(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const castIds = response.castIds || [];

    // Fetch cast profiles for each castId
    const casts: FollowingCast[] = [];
    for (const castId of castIds) {
      try {
        const castResponse = await castClient.getCastProfile(
          { userId: castId },
          { headers: buildGrpcHeaders(req.headers) }
        );
        if (castResponse.profile) {
          const firstArea = castResponse.profile.areas?.[0];
          casts.push({
            id: castId,
            name: castResponse.profile.name,
            imageUrl: castResponse.profile.avatarUrl || "",
            area: firstArea?.name || "",
          });
        }
      } catch (e) {
        // Skip if cast profile not found
        console.warn(`Failed to fetch cast profile for ${castId}:`, e);
      }
    }

    return NextResponse.json({
      castIds,
      casts,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListFollowing");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { castId } = body;

    if (!castId) {
      return NextResponse.json({ error: "castId is required" }, { status: 400 });
    }

    const response = await followClient.followCast(
      { castId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
      status: response.status,
    });
  } catch (error: unknown) {
    return handleApiError(error, "FollowCast");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const castId = req.nextUrl.searchParams.get("cast_id");

    if (!castId) {
      return NextResponse.json({ error: "cast_id is required" }, { status: 400 });
    }

    const response = await followClient.unfollowCast(
      { castId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    return handleApiError(error, "UnfollowCast");
  }
}
