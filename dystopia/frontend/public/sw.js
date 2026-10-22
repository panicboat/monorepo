const FALLBACK_TITLE = "dystopia";
const FALLBACK_BODY = "新しいお知らせがあります";
const FALLBACK_URL = "/notifications";
const ICON_URL = "/pwa-icon/192";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function isAppPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return false;
  try {
    // The URL parser reads a backslash as a slash and drops tabs and newlines, so the prefix checks alone let off-origin paths through.
    return new URL(value, self.location.origin).origin === self.location.origin;
  } catch {
    // SILENT: A value the URL parser rejects is not an app path.
    return false;
  }
}

function readPayload(data) {
  try {
    const payload = data ? data.json() : null;
    if (!payload || typeof payload.title !== "string" || typeof payload.body !== "string" || !isAppPath(payload.url)) {
      throw new Error("unreadable payload");
    }
    return { title: payload.title, body: payload.body, url: payload.url };
  } catch {
    // FALLBACK: Safari revokes a subscription whose push shows nothing, so an unreadable payload still shows a generic notification.
    return { title: FALLBACK_TITLE, body: FALLBACK_BODY, url: FALLBACK_URL };
  }
}

self.addEventListener("push", (event) => {
  const { title, body, url } = readPayload(event.data);
  event.waitUntil(self.registration.showNotification(title, { body, icon: ICON_URL, data: { url } }));
});

async function openPage(path) {
  const url = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (existing) {
    try {
      await existing.focus();
      await existing.navigate(url);
      return;
    } catch {
      // FALLBACK: A window this worker does not control cannot be navigated, so a new one is opened.
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(openPage(isAppPath(target) ? target : FALLBACK_URL));
});
