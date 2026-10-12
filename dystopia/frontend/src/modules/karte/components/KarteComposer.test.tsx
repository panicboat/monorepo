// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KarteComposer } from "./KarteComposer";
import { useAuthStore } from "@/stores/authStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const fetchMock = vi.fn<typeof fetch>();
const created = vi.fn();
async function mount() { container = document.createElement("div"); root = createRoot(container); await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map() } }, createElement(KarteComposer, { targetProfileId: "guest", onCreated: created })))); }
async function choose(value: string) { const select = container.querySelector('select') as HTMLSelectElement; await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }); }
async function submit() { await act(async () => (container.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(() => { useAuthStore.setState({ accountId: "owner", role: "cast", activeProfileId: "writer" }); fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ entry: { id: "saved" } }))); vi.stubGlobal("fetch", fetchMock); created.mockReset(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T15:30:00Z")); });
afterEach(async () => { await act(async () => root?.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("KarteComposer", () => {
  it("starts with an unrated booking on the Japan date and requires an explicit outcome", async () => {
    await mount();
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("");
    expect((container.querySelector('[type="date"]') as HTMLInputElement).value).toBe("2026-10-12");
    await submit(); expect(fetchMock).not.toHaveBeenCalled();
    await choose("confirmed"); await submit();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ targetProfileId: "guest", rating: null, firstEvent: { stage: "booking", outcome: "confirmed", tags: [], note: "", occurredOn: "2026-10-12" } });
    expect(created).toHaveBeenCalledWith({ id: "saved" });
  });
  it("requires a note for no-show and preserves input when saving fails", async () => {
    await mount(); await choose("no_show"); await submit();
    expect(fetchMock).not.toHaveBeenCalled(); expect(container.textContent).toContain("補足が必要");
    await choose("confirmed"); fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "保存できません" }), { status: 503 }));
    await submit();
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("confirmed");
    expect(container.textContent).toContain("保存できません"); expect(created).not.toHaveBeenCalled();
  });
  it("does not notify another profile when an earlier save finishes", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await mount(); await choose("confirmed"); await submit();
    await act(async () => useAuthStore.getState().setActiveProfile("other"));
    await act(async () => { finish(new Response(JSON.stringify({ entry: { id: "saved" } }))); await Promise.resolve(); });
    expect(created).not.toHaveBeenCalled();
  });
});
