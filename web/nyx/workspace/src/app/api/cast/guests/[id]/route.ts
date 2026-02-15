import { NextRequest, NextResponse } from "next/server";
import { guestClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export interface GuestDetail {
  id: string;
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await guestClient.getGuestProfileById(
      { guestId: id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const profile = response.profile;
    if (!profile) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const guestDetail: GuestDetail = {
      id: profile.id,
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
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.code === 5) {
        return NextResponse.json({ error: "Guest not found" }, { status: 404 });
      }
    }
    console.error("GetGuestProfileById Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
