// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import type { KarteEntry } from "@/modules/karte/types";
import MyKartePage, { MyKarteHeader } from "./page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/components/compose/ComposeToDialog", () => ({ ComposeToDialog: ({ open, kind }: { open: boolean; kind: string }) => open ? createElement("div", { role: "dialog" }, `recipient:${kind}`) : null }));
let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
const requests: string[] = [];
const entry = (id: string, status: "open" | "closed"): KarteEntry => ({ id, status, authorProfileId: "writer", targetProfileId: "guest", isMine: true, authorUsername: "writer", authorAvatarUrl: "", targetUsername: id, targetAvatarUrl: "", rating: null, body: "", flagged: false, closedAt: null, events: [], latestEvent: null, eventCount: 0, createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z" });
const counts = { total: 3, open: 1, closed: 2 };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function mount() { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map(), errorRetryCount: 0, dedupingInterval: 0 } }, createElement(MyKartePage)))); }
beforeEach(() => { useAuthStore.setState({ accountId: "owner", activeProfileId: "writer", role: "cast" }); requests.length = 0; vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
  const url = String(input); requests.push(url); if (url === "/api/karte/access") return reply({ hasAccess: true });
  const parsed = new URL(url, "http://localhost"); const status = parsed.searchParams.get("status"); const more = parsed.searchParams.has("cursor");
  return reply({ entries: status === "open" ? [entry("open-entry", "open")] : status === "closed" ? [entry("closed-entry", "closed")] : more ? [entry("older-entry", "closed")] : [entry("open-entry", "open"), entry("closed-entry", "closed")], hasMore: status === "all" && !more, nextCursor: "older", counts });
}); });
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.unstubAllGlobals(); });

describe("MyKarteHeader", () => {
  it("describes management of reservation and service events", () => {
    const html = renderToStaticMarkup(<MyKarteHeader />);
    expect(html).toContain("自分のカルテ"); expect(html).toContain("予約・接客");
  });
});
describe("MyKartePage", () => {
  it("filters without mixing earlier pages and keeps global counts", async () => {
    await mount();
    expect(container.querySelectorAll("article")).toHaveLength(2);
    await act(async () => (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "もっと見る") as HTMLButtonElement).click());
    expect(container.querySelectorAll("article")).toHaveLength(3);
    await act(async () => (Array.from(container.querySelectorAll('[role="tab"]')).find((button) => button.textContent?.startsWith("記録中")) as HTMLButtonElement).click());
    expect(container.querySelectorAll("article")).toHaveLength(1); expect(container.textContent).toContain("open-entry"); expect(container.textContent).not.toContain("older-entry");
    expect(container.textContent).toContain("全件 (3)"); expect(container.textContent).toContain("完了 (2)");
    expect(requests.some((url) => url.includes("status=open"))).toBe(true);
  });
  it("opens recipient selection for a new chart", async () => {
    await mount(); await act(async () => (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "カルテを記録") as HTMLButtonElement).click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toBe("recipient:karte");
  });
  it("shows an access failure with retry instead of a subscription or empty state", async () => {
    vi.stubGlobal("fetch", async () => reply({ error: "アクセスを確認できません" }, 500)); await mount();
    expect(container.textContent).toContain("アクセスを確認できません"); expect(container.textContent).not.toContain("有料機能"); expect(container.textContent).not.toContain("カルテはまだありません");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "再試行")).toBe(true);
  });
});
