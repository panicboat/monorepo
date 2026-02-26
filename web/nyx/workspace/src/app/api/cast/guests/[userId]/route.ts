import { NextRequest, NextResponse } from "next/server";
import { guestClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export interface GuestDetail {
  userId: string;
  name: string;
  avatarUrl: string;
  tagline: string;
  bio: string;
  isFollowing: boolean;
  followedAt: string;
  isBlocked: boolean;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { userId } = await params;

    const response = await guestClient.getGuestProfileById(
      { userId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const profile = response.profile;
    if (!profile) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const guestDetail: GuestDetail = {
      userId: profile.userId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      tagline: profile.tagline,
      bio: profile.bio,
      isFollowing: profile.isFollowing,
      followedAt: profile.followedAt,
      isBlocked: profile.isBlocked,
    };

    return NextResponse.json(guestDetail);
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }
    return handleApiError(error, "GetGuestProfileById");
  }
}
