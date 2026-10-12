// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { GuestKarteTab } from "./GuestKarteTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const fetchMock = vi.fn<typeof fetch>();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function mount() { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map(), errorRetryCount: 0 } }, createElement(GuestKarteTab, { guestProfileId: "known-guest" })))); }
beforeEach(() => { useAuthStore.setState({ accountId: "owner", activeProfileId: "writer", role: "cast" }); fetchMock.mockReset().mockImplementation(async () => reply({ entries: [], hasMore: false, aggregate: { count: 6, avgRating: 3, authorCount: 2, ratedCount: 4 } })); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window.history, "back").mockImplementation(() => {}); });
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); useToastStore.getState().hide(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("GuestKarteTab", () => {
  it("puts the aggregate before the creation action and skips recipient selection for a known guest", async () => {
    await mount();
    expect(container.textContent?.indexOf("平均")).toBeLessThan(container.textContent?.indexOf("カルテを記録") ?? 0);
    expect(document.querySelector("textarea")).toBeNull();
    await act(async () => (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "カルテを記録") as HTMLButtonElement).click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const select = document.querySelector("select") as HTMLSelectElement;
    await act(async () => { select.value = "confirmed"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    fetchMock.mockImplementation(async (_url, options) => options?.method === "POST" ? reply({ entry: { id: "saved" } }) : reply({ entries: [], hasMore: false, aggregate: { count: 7, avgRating: 3, authorCount: 2, ratedCount: 4 } }));
    await act(async () => (document.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const write = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ targetProfileId: "known-guest", rating: null, firstEvent: { stage: "booking", outcome: "confirmed" } });
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/karte"))).toBe(true);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("shows fetch failures with a retry instead of an empty chart", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: "取得できません" }, 500)); await mount();
    expect(container.textContent).toContain("取得できません"); expect(container.textContent).not.toContain("カルテはまだありません");
    await act(async () => (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "再試行") as HTMLButtonElement).click());
    expect(container.textContent).toContain("3.0");
  });
});
