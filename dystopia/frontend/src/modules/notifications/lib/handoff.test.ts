import { afterEach, describe, expect, it, vi } from "vitest";
import { takeNotificationHandoff } from "./handoff";

function installCache(records: Record<string, unknown> = {}) {
  const stored = new Map(
    Object.entries(records).map(([key, value]) => [key, new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })])
  );
  const cache = {
    match: vi.fn(async (key: string) => stored.get(key)),
    delete: vi.fn(async (key: string) => stored.delete(key)),
  };
  const caches = { open: vi.fn(async () => cache) };
  vi.stubGlobal("caches", caches);
  return { caches, stored };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("takeNotificationHandoff", () => {
  it("returns the record for the id once and removes it", async () => {
    const { caches, stored } = installCache({ "/notifications/open/tap-1": { profile: "p2", to: "/posts/1" } });

    expect(await takeNotificationHandoff("tap-1")).toEqual({ profile: "p2", to: "/posts/1" });
    expect(caches.open).toHaveBeenCalledWith("notification-open");
    expect(stored.has("/notifications/open/tap-1")).toBe(false);
    expect(await takeNotificationHandoff("tap-1")).toBeNull();
  });

  it("reads values that are not strings as missing", async () => {
    installCache({ "/notifications/open/tap-1": { profile: 7, to: null } });

    expect(await takeNotificationHandoff("tap-1")).toEqual({ profile: null, to: null });
  });

  it("returns nothing without an id or a record", async () => {
    const { caches } = installCache({ "/notifications/open/tap-1": { profile: "p2", to: "/posts/1" } });

    expect(await takeNotificationHandoff(null)).toBeNull();
    expect(await takeNotificationHandoff("")).toBeNull();
    expect(caches.open).not.toHaveBeenCalled();
    expect(await takeNotificationHandoff("tap-2")).toBeNull();
  });

  it("returns nothing where the browser has no cache storage", async () => {
    vi.stubGlobal("caches", undefined);

    expect(await takeNotificationHandoff("tap-1")).toBeNull();
  });

  it("returns nothing when the cache cannot be read", async () => {
    vi.stubGlobal("caches", { open: vi.fn(async () => Promise.reject(new DOMException("denied", "SecurityError"))) });

    expect(await takeNotificationHandoff("tap-1")).toBeNull();
  });
});
