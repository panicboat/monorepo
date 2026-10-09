// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { useMessages } = await import("./useMessages");

const server = { messages: [{ id: "m1", content: "first" }], requests: [] as string[] };

vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  server.requests.push(url);
  return new Response(JSON.stringify({ messages: server.messages, nextCursor: "", hasMore: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

let shown: string[] = [];
const mounted: (() => Promise<void>)[] = [];

async function openThread(threadId: string) {
  const Probe = () => {
    shown = useMessages(threadId).messages.map((message) => message.content);
    return null;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
  await act(async () => {
    root.render(createElement(SWRConfig, { value: { provider: () => new Map() } }, createElement(Probe)));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  server.messages = [{ id: "m1", content: "first" }];
  server.requests.length = 0;
  shown = [];
  useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
});

afterEach(async () => {
  while (mounted.length > 0) await mounted.pop()?.();
  vi.useRealTimers();
});

describe("useMessages", () => {
  it("shows a message that arrives while the conversation stays open", async () => {
    await openThread("t1");
    expect(shown).toEqual(["first"]);

    server.messages = [{ id: "m2", content: "second" }, { id: "m1", content: "first" }];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(shown).toEqual(["second", "first"]);
  });

  it("asks again only for the newest page, and stops once the conversation is closed", async () => {
    await openThread("t1");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13000);
    });
    const whileOpen = server.requests.length;

    await mounted.pop()?.();
    await vi.advanceTimersByTimeAsync(30000);

    expect(whileOpen).toBeGreaterThanOrEqual(3);
    expect(new Set(server.requests)).toEqual(new Set(["/api/messaging/threads/t1/messages"]));
    expect(server.requests.length).toBe(whileOpen);
  });
});
