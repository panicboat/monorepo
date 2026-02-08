import { NextRequest, NextResponse } from "next/server";
import { socialClient, castClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

interface FollowingCast {
  id: string;
  name: string;
  imageUrl: string;
  area: string;
}

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const response = await socialClient.listFollowing(
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
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListFollowing Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { castId } = body;

    if (!castId) {
      return NextResponse.json({ error: "castId is required" }, { status: 400 });
    }

    const response = await socialClient.followCast(
      { castId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("FollowCast Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const castId = req.nextUrl.searchParams.get("cast_id");

    if (!castId) {
      return NextResponse.json({ error: "cast_id is required" }, { status: 400 });
    }

    const response = await socialClient.unfollowCast(
      { castId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("UnfollowCast Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
