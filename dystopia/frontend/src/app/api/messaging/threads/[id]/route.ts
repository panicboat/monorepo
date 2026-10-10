import { NextRequest, NextResponse } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { threadProtoToView } from "@/modules/messaging/lib/mappers";
import { sendRestrictionProtoToView } from "@/modules/messaging/lib/send-restriction";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = await buildGrpcHeaders(req);
    const res = await messagingClient.getThread({ threadId: id }, { headers });
    return NextResponse.json({
      thread: res.thread ? threadProtoToView(res.thread) : null,
      sendRestriction: sendRestrictionProtoToView(res.sendRestriction),
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetThread");
  }
}
