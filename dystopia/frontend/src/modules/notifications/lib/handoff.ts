export interface NotificationHandoff {
  profile: string | null;
  to: string | null;
}

const HANDOFF_CACHE = "notification-open";
const HANDOFF_PATH = "/notifications/open/";

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function takeNotificationHandoff(id: string | null): Promise<NotificationHandoff | null> {
  if (!id || typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(HANDOFF_CACHE);
    const key = HANDOFF_PATH + id;
    const response = await cache.match(key);
    if (!response) return null;
    await cache.delete(key);
    const record = await response.json();
    return { profile: readString(record?.profile), to: readString(record?.to) };
  } catch {
    // SILENT: An unreadable record counts as none, so the open page shows the notification list without switching profiles.
    return null;
  }
}
