// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const server = vi.hoisted(() => ({ unread: 2 }));

vi.mock("@/lib/swr", () => ({
  fetcher: async (url: string) => {
    if (url === "/api/notifications/unread-count") return { count: server.unread };
    return {
      notifications: [
        { id: "n-1", readAt: null },
        { id: "n-2", readAt: null },
      ],
      unreadCount: server.unread,
      hasMore: false,
      nextCursor: "",
    };
  },
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign((selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "p-1" }), {
    getState: () => ({ accountId: "a-1", activeProfileId: "p-1" }),
  }),
}));
vi.mock("@/lib/auth/profile-headers", () => ({ PROFILE_ID_HEADER: "x-profile-id", profileRequestHeaders: () => ({}) }));

const { useNotifications } = await import("./useNotifications");
const { useUnreadCount } = await import("./useUnreadCount");

const actions: { markRead?: (id: string) => Promise<void>; markAllRead?: () => Promise<void> } = {};

function Probe() {
  const { count } = useUnreadCount();
  const notifications = useNotifications();
  actions.markRead = notifications.markRead;
  actions.markAllRead = notifications.markAllRead;
  return createElement("span", { "data-testid": "badge" }, String(count));
}

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

let root: ReturnType<typeof createRoot>;
let container: HTMLElement;

beforeEach(async () => {
  server.unread = 2;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wrap = (children: ReactNode) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  await act(async () => root.render(wrap(createElement(Probe))));
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const badge = () => container.querySelector('[data-testid="badge"]')?.textContent;

describe("notification badge", () => {
  it("lowers the badge once a notification is read", async () => {
    expect(badge()).toBe("2");

    server.unread = 1;
    await act(async () => { await actions.markRead?.("n-1"); });
    await flush();

    expect(badge()).toBe("1");
  });

  it("clears the badge once every notification is read", async () => {
    server.unread = 0;
    await act(async () => { await actions.markAllRead?.(); });
    await flush();

    expect(badge()).toBe("0");
  });
});
