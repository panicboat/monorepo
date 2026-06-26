import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import type { NotificationPreferences } from "@/modules/notifications/types";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  post: true,
  like: true,
  repost: true,
  quote: true,
  reply: true,
  follow: true,
  mention: true,
  message: true,
  oshi: true,
  footprintUnreadBadge: true,
  footprintsRecordMyVisits: true,
};

function toView(prefs: {
  pushEnabled?: boolean;
  post?: boolean;
  like?: boolean;
  repost?: boolean;
  quote?: boolean;
  reply?: boolean;
  follow?: boolean;
  mention?: boolean;
  message?: boolean;
  oshi?: boolean;
  footprintUnreadBadge?: boolean;
  footprintsRecordMyVisits?: boolean;
} | undefined): NotificationPreferences {
  if (!prefs) return { ...DEFAULT_PREFERENCES };
  return {
    pushEnabled: !!prefs.pushEnabled,
    post: !!prefs.post,
    like: !!prefs.like,
    repost: !!prefs.repost,
    quote: !!prefs.quote,
    reply: !!prefs.reply,
    follow: !!prefs.follow,
    mention: !!prefs.mention,
    message: !!prefs.message,
    oshi: !!prefs.oshi,
    footprintUnreadBadge: !!prefs.footprintUnreadBadge,
    footprintsRecordMyVisits: !!prefs.footprintsRecordMyVisits,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const res = await notificationClient.getNotificationPreferences({}, { headers });
    return NextResponse.json(toView(res.preferences));
  } catch (error: unknown) {
    return handleApiError(error, "GetNotificationPreferences");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req);
    const body = (await req.json()) as Partial<NotificationPreferences>;
    // Merge with defaults so a partial body still produces a complete proto payload.
    const merged: NotificationPreferences = { ...DEFAULT_PREFERENCES, ...body };
    const res = await notificationClient.updateNotificationPreferences(
      { preferences: merged },
      { headers }
    );
    return NextResponse.json(toView(res.preferences));
  } catch (error: unknown) {
    return handleApiError(error, "UpdateNotificationPreferences");
  }
}
