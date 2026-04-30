import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";
import { mapProtoFollowRequestsListToJson } from "@/modules/relationship/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);

    const response = await followClient.listPendingFollowRequests(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoFollowRequestsListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListPendingFollowRequests");
  }
}
