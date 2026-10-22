import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    await notificationClient.registerPushSubscription(
      { endpoint: text(body?.endpoint), p256dh: text(body?.p256dh), auth: text(body?.auth) },
      { headers }
    );
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "RegisterPushSubscription");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    await notificationClient.unregisterPushSubscription({ endpoint: text(body?.endpoint) }, { headers });
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "UnregisterPushSubscription");
  }
}
