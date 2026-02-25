import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapProtoTaggingsListToJson } from "@/modules/trust/lib/api-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const targetId = req.nextUrl.searchParams.get("target_id");
    if (!targetId) {
      return NextResponse.json({ error: "target_id is required" }, { status: 400 });
    }

    const response = await trustClient.listTargetTags(
      { targetId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(mapProtoTaggingsListToJson(response));
  } catch (error: unknown) {
    return handleApiError(error, "ListTargetTags");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { tagName, targetId } = await req.json();
    if (!tagName || !targetId) {
      return NextResponse.json({ error: "tagName and targetId are required" }, { status: 400 });
    }

    const response = await trustClient.addTagging(
      { tagName, targetId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (isConnectError(error)) {
      if (error.code === GrpcCode.INVALID_ARGUMENT) {
        return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
      }
      if (error.code === GrpcCode.ALREADY_EXISTS) {
        return NextResponse.json({ error: "Tagging already exists" }, { status: 409 });
      }
    }
    return handleApiError(error, "AddTagging");
  }
}
