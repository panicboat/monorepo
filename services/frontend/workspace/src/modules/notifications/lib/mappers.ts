import type { Notification } from "@/stub/notifications/v1/notification_service_pb";
import { profileToSocialAccount } from "@/modules/social";
import type { NotificationView } from "../types";

function timestampToIso(ts: { seconds?: bigint | number; nanos?: number } | undefined): string {
  if (!ts) return "";
  const seconds = typeof ts.seconds === "bigint" ? Number(ts.seconds) : (ts.seconds || 0);
  const millis = seconds * 1000 + Math.floor((ts.nanos || 0) / 1_000_000);
  return new Date(millis).toISOString();
}

export function notificationToView(n: Notification): NotificationView {
  return {
    id: n.id,
    type: n.type,
    targetResourceId: n.targetResourceId,
    actorCount: n.actorCount,
    latestActor: n.latestActor ? profileToSocialAccount(n.latestActor) : null,
    latestEventAt: timestampToIso(n.latestEventAt),
    readAt: n.readAt ? timestampToIso(n.readAt) : null,
    targetPostId: n.targetPostId || null,
  };
}
