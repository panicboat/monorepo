import { NextRequest, NextResponse } from "next/server";
import { guestClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await guestClient.getGuestProfile(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const profile = response.profile
      ? {
          userId: response.profile.userId,
          name: response.profile.name,
          avatarUrl: response.profile.avatarUrl,
          avatarMediaId: response.profile.avatarMediaId,
          tagline: response.profile.tagline,
          bio: response.profile.bio,
        }
      : null;

    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error instanceof ConnectError && error.code === 5) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    console.error("GetGuestProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await guestClient.saveGuestProfile(
      {
        name: body.name,
        avatarMediaId: body.avatarMediaId || "",
        tagline: body.tagline || "",
        bio: body.bio || "",
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const profile = response.profile
      ? {
          userId: response.profile.userId,
          name: response.profile.name,
          avatarUrl: response.profile.avatarUrl,
          avatarMediaId: response.profile.avatarMediaId,
          tagline: response.profile.tagline,
          bio: response.profile.bio,
        }
      : null;

    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error instanceof ConnectError && error.code === 3) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("SaveGuestProfile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
