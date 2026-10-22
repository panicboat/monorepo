import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");
const ORIGIN = "https://dystopia.city";

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(
  windows: Array<{ url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }> = [],
  { failStore = false } = {}
) {
  const listeners: Record<string, Listener> = {};
  const showNotification = vi.fn<(title: string, options: NotificationOptions) => Promise<void>>(async () => {});
  const openWindow = vi.fn(async () => null);
  const calls: string[] = [];
  const stored = new Map<string, Response>();
  const cache = {
    put: vi.fn(async (key: string, response: Response) => {
      if (failStore) throw new Error("quota exceeded");
      calls.push("put");
      stored.set(key, response);
    }),
  };
  const caches = {
    delete: vi.fn(async (name: string) => {
      calls.push(`delete ${name}`);
      return true;
    }),
    open: vi.fn(async (name: string) => {
      calls.push(`open ${name}`);
      return cache;
    }),
  };
  const self = {
    location: { origin: ORIGIN },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow, claim: vi.fn(async () => {}) },
    crypto: { randomUUID: () => "tap-1" },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
  };
  vm.runInNewContext(source, { self, URL, Response, caches });
  return { listeners, showNotification, openWindow, caches, calls, stored };
}

async function dispatch(listener: Listener, event: Record<string, unknown>) {
  const pending: Promise<unknown>[] = [];
  listener({ ...event, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
  await Promise.all(pending);
}

const pushData = (payload: unknown) => ({ json: () => payload });
const brokenData = { json: () => JSON.parse("not json") };

function click(url: unknown) {
  return { notification: { close: vi.fn(), data: { url } } };
}

describe("service worker", () => {
  it("shows the pushed title and body and keeps the page to open", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.push, { data: pushData({ title: "りん", body: "あなたの投稿にいいねしました", url: "/notifications/open?profile=p&to=%2Fposts%2F1" }) });

    expect(worker.showNotification).toHaveBeenCalledWith("りん", {
      body: "あなたの投稿にいいねしました",
      icon: "/pwa-icon/192",
      data: { url: "/notifications/open?profile=p&to=%2Fposts%2F1" },
    });
  });

  it("still shows a generic notification for a missing or unreadable payload", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.push, { data: null });
    await dispatch(worker.listeners.push, { data: brokenData });
    await dispatch(worker.listeners.push, { data: pushData({ title: 1, url: "https://evil.example" }) });
    await dispatch(worker.listeners.push, { data: pushData({ title: "りん", body: "あなたの投稿にいいねしました", url: "/\\evil.example/x" }) });

    expect(worker.showNotification).toHaveBeenCalledTimes(4);
    for (const [title, options] of worker.showNotification.mock.calls) {
      expect(title).toBe("dystopia");
      expect(options).toEqual({ body: "新しいお知らせがあります", icon: "/pwa-icon/192", data: { url: "/notifications" } });
    }
  });

  it("records the tap and opens the profile handoff page with only the record's id", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.notificationclick, click("/notifications/open?profile=p&to=%2Fposts%2F1"));

    expect(worker.calls).toEqual(["delete notification-open", "open notification-open", "put"]);
    expect([...worker.stored.keys()]).toEqual(["/notifications/open/tap-1"]);
    expect(await worker.stored.get("/notifications/open/tap-1")?.json()).toEqual({ profile: "p", to: "/posts/1" });
    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications/open?id=tap-1`);
  });

  it("opens any other app page unchanged without recording anything", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.notificationclick, click("/posts/1?profile=p"));

    expect(worker.caches.delete).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/posts/1?profile=p`);
  });

  it("opens the notification list when the tap cannot be recorded", async () => {
    const worker = loadWorker([], { failStore: true });

    await dispatch(worker.listeners.notificationclick, click("/notifications/open?profile=p&to=%2Fposts%2F1"));

    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
  });

  it("brings an open window forward and navigates it to the page", async () => {
    const open = { url: `${ORIGIN}/home`, focus: vi.fn(async () => open), navigate: vi.fn(async () => open) };
    const worker = loadWorker([open]);
    const event = click("/notifications/open?profile=p&to=%2Fposts%2F1");

    await dispatch(worker.listeners.notificationclick, event);

    expect(event.notification.close).toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith(`${ORIGIN}/notifications/open?id=tap-1`);
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when none is open or the open one cannot be navigated", async () => {
    const stuck = { url: `${ORIGIN}/home`, focus: vi.fn(async () => stuck), navigate: vi.fn(async () => Promise.reject(new TypeError("not controlled"))) };
    const empty = loadWorker();
    const uncontrolled = loadWorker([stuck]);

    await dispatch(empty.listeners.notificationclick, click("/posts/1"));
    await dispatch(uncontrolled.listeners.notificationclick, click("/posts/1"));

    expect(empty.openWindow).toHaveBeenCalledWith(`${ORIGIN}/posts/1`);
    expect(uncontrolled.openWindow).toHaveBeenCalledWith(`${ORIGIN}/posts/1`);
  });

  it("opens the notification list for a page outside the app", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.notificationclick, click("//evil.example/x"));

    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
  });

  it("opens the notification list for a path the URL parser resolves to another origin", async () => {
    const backslash = loadWorker();
    const tab = loadWorker();

    await dispatch(backslash.listeners.notificationclick, click("/\\evil.example/x"));
    await dispatch(tab.listeners.notificationclick, click("/\t/evil.example/x"));

    expect(backslash.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
    expect(tab.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
  });
});
