import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";
import { mapProtoBlockedListToJson } from "@/modules/relationship/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams, 50);

    const response = await blockClient.listBlocked(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoBlockedListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListBlocked");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { blockedId, blockedType } = body;

    if (!blockedId || !blockedType) {
      return NextResponse.json(
        { error: "blockedId and blockedType are required" },
        { status: 400 }
      );
    }

    const response = await blockClient.blockUser(
      { blockedId, blockedType, blockerType: "guest" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    return handleApiError(error, "BlockUser");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const blockedId = req.nextUrl.searchParams.get("blocked_id");

    if (!blockedId) {
      return NextResponse.json(
        { error: "blocked_id is required" },
        { status: 400 }
      );
    }

    const response = await blockClient.unblockUser(
      { blockedId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
    });
  } catch (error: unknown) {
    return handleApiError(error, "UnblockUser");
  }
}
