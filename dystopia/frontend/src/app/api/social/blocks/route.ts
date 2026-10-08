import { NextRequest, NextResponse } from "next/server";
import { socialBlockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    const targetProfileId = body?.targetProfileId ?? "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "targetProfileId required" }, { status: 400 });
    }
    await socialBlockClient.block({ targetProfileId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Block");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const targetProfileId = req.nextUrl.searchParams.get("target_profile_id") || "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "target_profile_id required" }, { status: 400 });
    }
    await socialBlockClient.unblock({ targetProfileId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unblock");
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await socialBlockClient.listBlocked({ limit, cursor }, { headers });
    return NextResponse.json({
      profiles: (res.profiles || []).map(profileToSocialAccount),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListBlocked");
  }
}
