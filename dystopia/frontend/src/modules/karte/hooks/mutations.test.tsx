// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { useCreateKarte } from "./useCreateKarte";
import { useUpdateKarte } from "./useUpdateKarte";
import { useKarteEvents } from "./useKarteEvents";
import { useKarteLifecycle } from "./useKarteLifecycle";
import { useMyKarte } from "./useMyKarte";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const firstEvent = { stage: "booking" as const, outcome: "confirmed", tags: [], note: "", occurredOn: "2026-10-12" };
const input = { targetProfileId: "guest", rating: null, firstEvent };
let current: { create: ReturnType<typeof useCreateKarte>; update: ReturnType<typeof useUpdateKarte>; events: ReturnType<typeof useKarteEvents>; lifecycle: ReturnType<typeof useKarteLifecycle> };
let unmount: (() => Promise<void>) | undefined;
let total = 0;
const fetchMock = vi.fn<typeof fetch>();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function mount(withList = false) {
  const root = createRoot(document.createElement("div"));
  function Probe() {
    current = { create: useCreateKarte(), update: useUpdateKarte(), events: useKarteEvents("entry"), lifecycle: useKarteLifecycle("entry") };
    return null;
  }
  function List() { total = useMyKarte().counts.total; return null; }
  unmount = async () => { await act(async () => root.unmount()); unmount = undefined; };
  await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map(), errorRetryCount: 0 } }, createElement(Probe), withList ? createElement(List) : null)));
}

beforeEach(() => {
  useAuthStore.setState({ accountId: "owner", role: "cast", activeProfileId: "writer" });
  fetchMock.mockReset().mockImplementation(async () => reply({ entry: { id: "entry" } }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await unmount?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("karte mutations", () => {
  it("refreshes an infinite list after the saved response", async () => {
    let saved = false;
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") { saved = true; return reply({ entry: { id: "saved" } }); }
      return reply({ entries: [], hasMore: false, nextCursor: "", counts: { total: saved ? 1 : 0, open: saved ? 1 : 0, closed: 0 } });
    });
    await mount(true);
    expect(total).toBe(0);
    await act(async () => { await current.create.create(input); });
    expect(total).toBe(1);
  });
  it("returns the saved entry even if refreshing a list fails", async () => {
    let saved = false;
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") { saved = true; return reply({ entry: { id: "saved" } }); }
      return saved ? reply({ error: "取得できませんでした" }, 503) : reply({ entries: [], hasMore: false, counts: { total: 0, open: 0, closed: 0 } });
    });
    await mount(true);
    await act(async () => { expect(await current.create.create(input)).toEqual({ id: "saved" }); });
    expect(current.create.error).toBeNull();
  });
  it("sends one request while pending and waits for its response", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await mount();
    let pending!: Promise<unknown>;
    await act(async () => { pending = current.create.create(input); });
    expect(current.create.loading).toBe(true);
    await act(async () => { await expect(current.create.create(input)).rejects.toThrow(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ "x-profile-id": "writer" });
    await act(async () => { finish(reply({ entry: { id: "saved" } })); expect(await pending).toMatchObject({ id: "saved" }); });
    expect(current.create.loading).toBe(false);
  });

  it("propagates save failures and permits a retry", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: "補足が必要です" }, 400));
    await mount();
    await act(async () => { await expect(current.create.create(input)).rejects.toThrow("補足が必要です"); });
    expect(current.create.error?.message).toBe("補足が必要です");
    expect(current.create.loading).toBe(false);
    await act(async () => { expect(await current.create.create(input)).toMatchObject({ id: "entry" }); });
    expect(current.create.error).toBeNull();
  });

  it.each(["profile", "unmount"])("does not return a result to a stale %s", async (change) => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await mount();
    let pending!: Promise<unknown>;
    await act(async () => { pending = current.create.create(input); });
    const rejected = expect(pending).rejects.toThrow("操作元のプロフィールが変わりました");
    if (change === "profile") await act(async () => useAuthStore.getState().setActiveProfile("other"));
    else await unmount?.();
    await act(async () => { finish(reply({ entry: { id: "old-profile-result" } })); await rejected; });
  });

  it("preserves update presence and scopes event and lifecycle operations", async () => {
    await mount();
    await act(async () => {
      await current.update.update("entry", { body: "legacy memo" });
      await current.events.add(firstEvent);
      await current.events.update("event", firstEvent);
      await current.events.remove("event");
      await current.lifecycle.close();
      await current.lifecycle.reopen();
    });
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ["/api/karte/entry", "PATCH"], ["/api/karte/entry/events", "POST"], ["/api/karte/entry/events/event", "PATCH"],
      ["/api/karte/entry/events/event", "DELETE"], ["/api/karte/entry/close", "POST"], ["/api/karte/entry/reopen", "POST"],
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ body: "legacy memo" });
  });

  it("finishes a stalled request at the existing authFetch deadline", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    await mount();
    let pending!: Promise<unknown>;
    await act(async () => { pending = current.create.create(input); });
    const rejected = expect(pending).rejects.toThrow("ネットワーク接続を確認してください");
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); await rejected; });
    expect(current.create.loading).toBe(false);
  });
});
