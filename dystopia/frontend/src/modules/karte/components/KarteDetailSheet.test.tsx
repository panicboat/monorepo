// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { KarteDetailSheet } from "./KarteDetailSheet";
import type { KarteEntry, KarteEvent } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const makeEvent = (id: string): KarteEvent => ({ id, entryId: "entry", stage: "booking", outcome: "confirmed", tags: [], note: "予約時の補足", occurredOn: "2026-10-12", createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z" });
let entry: KarteEntry;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const changed = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const buttons = () => Array.from(document.querySelectorAll("button"));
async function click(text: string) { const button = buttons().find((item) => item.textContent?.trim() === text || item.getAttribute("aria-label") === text); if (!button) throw new Error(`button missing: ${text}`); await act(async () => button.click()); }
async function mount() {
  function Harness() { const [id, setId] = useState<string | null>(null); return createElement("div", null, createElement("button", { onClick: () => setId("entry") }, "開く"), createElement(KarteDetailSheet, { entryId: id, onOpenChange: (open) => { if (!open) setId(null); }, onChanged: changed })); }
  function Scoped() { const profileId = useAuthStore((state) => state.activeProfileId); return createElement(SWRConfig, { key: profileId, value: { provider: () => new Map(), errorRetryCount: 0, dedupingInterval: 0 } }, createElement(Harness)); }
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(createElement(Scoped))); await click("開く");
}
async function note(value: string) { const field = document.querySelector("textarea") as HTMLTextAreaElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit() { await act(async () => (document.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(() => {
  useAuthStore.setState({ accountId: "owner", activeProfileId: "persona-b", role: "cast" });
  entry = { id: "entry", authorProfileId: "persona-a", targetProfileId: "guest", isMine: true, authorUsername: "persona_a", authorAvatarUrl: "", targetUsername: "guest", targetAvatarUrl: "", rating: 4, body: "過去の説明", flagged: false, status: "open", closedAt: null, events: [makeEvent("one")], latestEvent: makeEvent("one"), eventCount: 1, createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z" };
  fetchMock.mockReset().mockImplementation(async () => reply({ entry })); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window.history, "back").mockImplementation(() => {}); window.history.replaceState(null, "", "/karte/my"); changed.mockReset(); useToastStore.getState().hide();
});
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); useToastStore.getState().hide(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("KarteDetailSheet", () => {
  it("shows legacy memo, attribution and ownership from another acting profile", async () => {
    await mount();
    expect(document.body.textContent).toContain("過去のメモ"); expect(document.body.textContent).toContain("過去の説明"); expect(document.body.textContent).toContain("@persona_a として記録");
    expect(buttons().some((button) => button.textContent === "出来事を追加")).toBe(true);
    expect(document.querySelector('a[href="/u/guest"]')).not.toBeNull();
  });
  it("lets another cast read the details and report them", async () => {
    entry.isMine = false; await mount();
    expect(buttons().some((button) => button.textContent === "出来事を追加")).toBe(false);
    expect(buttons().some((button) => button.textContent === "完了する")).toBe(false);
    await click("報告"); await note("記録の内容を確認してください");
    fetchMock.mockImplementation(async (_url, options) => options?.method === "POST" ? reply({ ok: true }) : reply({ entry }));
    await submit();
    expect(fetchMock.mock.calls.some(([url, options]) => url === "/api/karte/entry/report" && options?.body === JSON.stringify({ reason: "記録の内容を確認してください" }))).toBe(true);
  });
  it("closes and reopens without losing events or rating", async () => {
    fetchMock.mockImplementation(async (url) => { if (url === "/api/karte/entry/close") { entry = { ...entry, status: "closed", closedAt: "2026-10-12T01:00:00Z" }; } if (url === "/api/karte/entry/reopen") entry = { ...entry, status: "open", closedAt: null }; return reply({ entry }); });
    await mount(); await click("完了する");
    expect(buttons().some((button) => button.textContent === "出来事を追加")).toBe(false);
    await click("再オープンする");
    expect(entry).toMatchObject({ status: "open", rating: 4, eventCount: 1 }); expect(changed).toHaveBeenCalledWith("entry");
  });
  it("reads an event-free legacy entry and offers reopening before editing", async () => {
    entry = { ...entry, status: "closed", closedAt: entry.updatedAt, rating: 1, body: "", events: [], eventCount: 0, latestEvent: null };
    await mount(); expect(document.body.textContent).toContain("出来事はまだありません");
    expect(buttons().some((button) => button.textContent === "評価・メモを変更")).toBe(false);
    expect(buttons().some((button) => button.textContent === "再オープンする")).toBe(true);
  });
  it("can retry a failed read", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: "取得できません" }, 500)); await mount();
    expect(document.body.textContent).toContain("取得できません"); await click("再試行"); expect(document.body.textContent).toContain("予約時の補足");
  });
  it("keeps a draft and refreshes the state after a completion conflict", async () => {
    await mount(); await click("出来事を編集：予約成立"); await note("保持する補足");
    fetchMock.mockImplementation(async (_url, options) => { if (options?.method === "PATCH") { entry = { ...entry, status: "closed", closedAt: entry.updatedAt }; return reply({ error: "完了したカルテは変更できません" }, 409); } return reply({ entry }); });
    await submit();
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("保持する補足"); expect(document.body.textContent).toContain("完了したカルテは変更できません");
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "GET").length).toBeGreaterThanOrEqual(2);
    await click("前の画面に戻る"); expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
  it("clears a rating without changing events or attribution", async () => {
    fetchMock.mockImplementation(async (_url, options) => { if (options?.method === "PATCH") { const attrs = JSON.parse(String(options.body)); entry = { ...entry, ...attrs }; } return reply({ entry }); });
    await mount(); await click("評価・メモを変更"); await click("未評価にする"); await submit();
    expect(entry).toMatchObject({ rating: null, authorProfileId: "persona-a", eventCount: 1 });
  });
  it("adds and deletes an event through its parent's endpoints", async () => {
    fetchMock.mockImplementation(async (url, options) => {
      if (url === "/api/karte/entry/events" && options?.method === "POST") { const input = JSON.parse(String(options.body)); entry = { ...entry, events: [...entry.events, { ...makeEvent("two"), ...input }], eventCount: 2 }; }
      if (url === "/api/karte/entry/events/two" && options?.method === "DELETE") entry = { ...entry, events: [entry.events[0]], eventCount: 1 };
      return reply({ entry });
    });
    await mount(); await click("出来事を追加");
    const select = document.querySelector("select") as HTMLSelectElement; await act(async () => { select.value = "confirmed"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await submit(); expect(entry.eventCount).toBe(2);
    const remove = Array.from(document.querySelectorAll('[aria-label="出来事を削除：予約成立"]'))[1] as HTMLButtonElement; await act(async () => remove.click());
    await click("出来事を削除する"); expect(entry.eventCount).toBe(1);
  });
  it("requires confirmation for deleting a closed parent", async () => {
    entry = { ...entry, status: "closed", closedAt: entry.updatedAt }; await mount(); await click("カルテを削除");
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== "DELETE")).toBe(true);
    fetchMock.mockImplementation(async (_url, options) => options?.method === "DELETE" ? reply({ ok: true }) : reply({ entry }));
    await click("カルテを削除する"); expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("sends failures to the existing toast after the form is closed", async () => {
    await mount(); await click("評価・メモを変更");
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation((_url, options) => options?.method === "PATCH" ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(reply({ entry })));
    await submit(); await click("閉じる");
    await act(async () => finish(reply({ error: "保存できませんでした" }, 500)));
    expect(useToastStore.getState().message).toBe("保存できませんでした");
  });
  it("discards the old panel when the acting profile changes during a save", async () => {
    await mount(); await click("評価・メモを変更");
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation((_url, options) => options?.method === "PATCH" ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(reply({ entry })));
    await submit(); await act(async () => useAuthStore.getState().setActiveProfile("another-persona"));
    await act(async () => finish(reply({ entry })));
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(changed).not.toHaveBeenCalled(); expect(useToastStore.getState().message).toBeNull();
  });
});
