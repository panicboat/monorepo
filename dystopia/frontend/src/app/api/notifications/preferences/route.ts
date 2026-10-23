import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import type { NotificationPreferences } from "@/modules/notifications/types";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  comment: true,
  like: true,
  reply: true,
  follow: true,
  mention: true,
  message: true,
  footprintUnreadBadge: true,
  footprintsRecordMyVisits: true,
};

function toView(prefs: Partial<NotificationPreferences> | undefined): NotificationPreferences {
  if (!prefs) return { ...DEFAULT_PREFERENCES };
  return {
    comment: !!prefs.comment,
    like: !!prefs.like,
    reply: !!prefs.reply,
    follow: !!prefs.follow,
    mention: !!prefs.mention,
    message: !!prefs.message,
    footprintUnreadBadge: !!prefs.footprintUnreadBadge,
    footprintsRecordMyVisits: !!prefs.footprintsRecordMyVisits,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
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

    const headers = await buildGrpcHeaders(req);
    const body = (await req.json()) as Partial<NotificationPreferences>;
    // Supply defaults because the proto payload requires every preference field.
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
