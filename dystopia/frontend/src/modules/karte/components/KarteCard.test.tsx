// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "persona-a" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { KarteCard } = await import("./KarteCard");

const event = (id: string, overrides: Partial<Karte["events"][number]> = {}): Karte["events"][number] => ({
  id, stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", ...overrides,
});

const karte = (overrides: Partial<Karte> = {}): Karte => ({
  id: "k-1",
  authorProfileId: "persona-a",
  author: { profileId: "persona-a", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
  targetProfileId: "guest-1",
  target: { profileId: "guest-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest", industry: "" },
  isMine: true,
  rating: null,
  events: [
    event("e-1"),
    event("e-2", { stage: "service", outcome: "ended_early", tags: ["late", "payment_trouble", "excessive_request"], note: "30分で帰った", occurredOn: "2026-10-14" }),
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  ...overrides,
});

async function mount(props: { karte: Karte; variant: "feed" | "guest" | "mine"; onOpen?: (k: Karte) => void }) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(KarteCard, { onOpen: vi.fn(), ...props }));
  });
  return container;
}

describe("KarteCard", () => {
  it("summarizes the karte with its latest event and two tags", async () => {
    const text = (await mount({ karte: karte(), variant: "feed" })).textContent;

    expect(text).toContain("KARTE / キャストからゲストへ");
    expect(text).toContain("ゆな");
    expect(text).toContain("はなこ");
    expect(text).toContain("@hanako");
    expect(text).toContain("未評価");
    expect(text).not.toContain("記録中");
    expect(text).toContain("10/14 · 接客 · 途中終了 — 30分で帰った");
    expect(text).toContain("遅刻あり");
    expect(text).toContain("支払いトラブルあり");
    expect(text).not.toContain("合意条件を超える要求あり");
  });

  it("shows the rating and no state mark", async () => {
    const container = await mount({ karte: karte({ rating: 4 }), variant: "feed" });

    expect(container.textContent).toContain("★ 4.0");
    expect(container.querySelector("article p")?.textContent).toBe("KARTE / キャストからゲストへ");
    expect(container.textContent).not.toContain("記録中");
  });

  it("leaves the dash out when the latest event has no note", async () => {
    const text = (await mount({ karte: karte({ events: [event("e-1")] }), variant: "feed" })).textContent;

    expect(text).toContain("10/1 · 予約・問い合わせ · 予約成立");
    expect(text).not.toContain(" — ");
  });

  it("renders no tag row when the latest event has no tags", async () => {
    const container = await mount({ karte: karte({ events: [event("e-1")] }), variant: "feed" });

    expect(container.querySelector("button .flex-wrap")).toBeNull();
  });

  it("renders the tag row when the latest event has tags", async () => {
    const container = await mount({ karte: karte(), variant: "feed" });

    expect(container.querySelector("button .flex-wrap")).not.toBeNull();
  });

  it("opens the karte from its summary", async () => {
    const onOpen = vi.fn();
    const subject = karte();
    const container = await mount({ karte: subject, variant: "feed", onOpen });

    (container.querySelector("button") as HTMLButtonElement).click();

    expect(onOpen).toHaveBeenCalledWith(subject);
  });

  it("links to the guest except on the guest's own profile", async () => {
    const feed = await mount({ karte: karte(), variant: "feed" });
    const guest = await mount({ karte: karte(), variant: "guest" });

    expect(feed.querySelector('a[href="/u/hanako"]')?.textContent).toBe("ゲストのプロフィールを見る →");
    expect(guest.textContent).not.toContain("ゲストのプロフィールを見る");
  });

  it("names the profile a karte of my list was written as when it is not the current one", async () => {
    const other = await mount({ karte: karte({ authorProfileId: "persona-b", author: { profileId: "persona-b", username: "yuna_osaka", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast", industry: "" } }), variant: "mine" });
    const deleted = await mount({ karte: karte({ authorProfileId: "persona-gone", author: null }), variant: "mine" });
    const current = await mount({ karte: karte(), variant: "mine" });

    expect(other.textContent).toContain("@yuna_osaka として記録");
    expect(deleted.textContent).toContain("（無効なキャスト）として記録");
    expect(current.textContent).not.toContain("として記録");
  });

  it("links the author's avatar and name to the author's profile", async () => {
    const container = await mount({ karte: karte(), variant: "feed" });
    const links = Array.from(container.querySelectorAll('a[href="/u/yuna"]'));

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.textContent)).toContain("ゆな");
  });

  it("leaves the author unlinked when the profile was deleted", async () => {
    const container = await mount({ karte: karte({ author: null }), variant: "feed" });

    expect(Array.from(container.querySelectorAll("a")).some((link) => link.getAttribute("href") === "/u/")).toBe(false);
    expect(container.textContent).toContain("（無効なキャスト）");
  });

  it("shows a question mark as the avatar initial when the author is missing", async () => {
    const missing = await mount({ karte: karte({ author: null }), variant: "feed" });
    const present = await mount({ karte: karte(), variant: "feed" });

    expect(missing.querySelector(".rounded-full")?.textContent).toBe("?");
    expect(present.querySelector(".rounded-full")?.textContent).toBe("ゆ");
  });

  it("names a missing target as an invalid guest without the handle or a link to the guest", async () => {
    const container = await mount({ karte: karte({ target: null }), variant: "feed" });

    expect(container.querySelector("button")?.textContent).toContain("（無効なゲスト）");
    expect(container.textContent).not.toContain("@");
    expect(container.textContent).not.toContain("ゲストのプロフィールを見る");
    expect(container.querySelector("a[href^='/u/']:not([href='/u/yuna'])")).toBeNull();
  });

  it("marks a private author next to the author name only", async () => {
    const base = karte();
    const container = await mount({ karte: karte({ author: { ...base.author!, isPrivate: true } }), variant: "feed" });

    expect(container.querySelector('p [aria-label="鍵付き"]')).not.toBeNull();
    expect(container.querySelector('button [aria-label="鍵付き"]')).toBeNull();
  });

  it("marks a private target next to the target name only", async () => {
    const base = karte();
    const container = await mount({ karte: karte({ target: { ...base.target!, isPrivate: true } }), variant: "feed" });

    expect(container.querySelector('button [aria-label="鍵付き"]')).not.toBeNull();
    expect(container.querySelector('p > [aria-label="鍵付き"], a [aria-label="鍵付き"]')).toBeNull();
  });

  it("shows no lock mark when neither side is private", async () => {
    const container = await mount({ karte: karte(), variant: "feed" });

    expect(container.querySelector('[aria-label="鍵付き"]')).toBeNull();
  });
});
