import { NextRequest, NextResponse } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req);
    await messagingClient.sendTyping({ threadId: id }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "SendTyping");
  }
}
