// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Review } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "persona-a" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { ReviewCard } = await import("./ReviewCard");

const event = (id: string, overrides: Partial<Review["events"][number]> = {}): Review["events"][number] => ({
  id, stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", ...overrides,
});

const review = (overrides: Partial<Review> = {}): Review => ({
  id: "k-1",
  authorProfileId: "persona-a",
  author: { profileId: "persona-a", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "guest", industry: "" },
  authorHidden: false,
  targetProfileId: "cast-1",
  target: { profileId: "cast-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
  isMine: true,
  rating: null,
  events: [
    event("e-1"),
    event("e-2", { stage: "service", outcome: "ended_early", tags: ["late", "not_as_pictured", "unagreed_charge"], note: "30分で帰った", occurredOn: "2026-10-14" }),
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  ...overrides,
});

async function mount(props: { review: Review; variant: "feed" | "cast" | "mine"; onOpen?: (k: Review) => void }) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(ReviewCard, { onOpen: vi.fn(), ...props }));
  });
  return container;
}

describe("ReviewCard", () => {
  it("summarizes the review with its latest event and two tags", async () => {
    const text = (await mount({ review: review(), variant: "feed" })).textContent;

    expect(text).toContain("クチコミ / ゲストからキャストへ");
    expect(text).toContain("ゆな");
    expect(text).toContain("はなこ");
    expect(text).toContain("@hanako");
    expect(text).toContain("未評価");
    expect(text).toContain("10/14 · 利用 · 途中で終了 — 30分で帰った");
    expect(text).not.toContain("記録中");
    expect(text).toContain("遅刻あり");
    expect(text).toContain("写真・プロフィールと違う");
    expect(text).not.toContain("合意していない料金・要求あり");
  });

  it("shows the rating and no state mark", async () => {
    const container = await mount({ review: review({ rating: 4 }), variant: "feed" });

    expect(container.textContent).toContain("★ 4.0");
    expect(container.querySelector("article p")?.textContent).toBe("クチコミ / ゲストからキャストへ");
    expect(container.textContent).not.toContain("記録中");
  });

  it("leaves the dash out when the latest event has no note", async () => {
    const text = (await mount({ review: review({ events: [event("e-1")] }), variant: "feed" })).textContent;

    expect(text).toContain("10/1 · 予約・問い合わせ · 予約成立");
    expect(text).not.toContain(" — ");
  });

  it("renders no tag row when the latest event has no tags", async () => {
    const container = await mount({ review: review({ events: [event("e-1")] }), variant: "feed" });

    expect(container.querySelector("button .flex-wrap")).toBeNull();
  });

  it("renders the tag row when the latest event has tags", async () => {
    const container = await mount({ review: review(), variant: "feed" });

    expect(container.querySelector("button .flex-wrap")).not.toBeNull();
  });

  it("opens the review from its summary", async () => {
    const onOpen = vi.fn();
    const subject = review();
    const container = await mount({ review: subject, variant: "feed", onOpen });

    (container.querySelector("button") as HTMLButtonElement).click();

    expect(onOpen).toHaveBeenCalledWith(subject);
  });

  it("links to the cast except on the cast's own profile", async () => {
    const feed = await mount({ review: review(), variant: "feed" });
    const cast = await mount({ review: review(), variant: "cast" });

    expect(feed.querySelector('a[href="/u/hanako"]')?.textContent).toBe("キャストのプロフィールを見る →");
    expect(cast.textContent).not.toContain("キャストのプロフィールを見る");
  });

  it("names the profile a review of my list was written as when it is not the current one", async () => {
    const other = await mount({ review: review({ authorProfileId: "persona-b", author: { profileId: "persona-b", username: "yuna_osaka", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "guest", industry: "" } }), variant: "mine" });
    const deleted = await mount({ review: review({ authorProfileId: "persona-gone", author: null }), variant: "mine" });
    const current = await mount({ review: review(), variant: "mine" });

    expect(other.textContent).toContain("@yuna_osaka として記録");
    expect(deleted.textContent).toContain("（無効なゲスト）として記録");
    expect(current.textContent).not.toContain("として記録");
  });

  it("links the author's avatar and name to the author's profile", async () => {
    const container = await mount({ review: review(), variant: "feed" });
    const links = Array.from(container.querySelectorAll('a[href="/u/yuna"]'));

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.textContent)).toContain("ゆな");
  });

  it("leaves the author unlinked when the profile was deleted", async () => {
    const container = await mount({ review: review({ author: null }), variant: "feed" });

    expect(Array.from(container.querySelectorAll("a")).some((link) => link.getAttribute("href") === "/u/")).toBe(false);
    expect(container.textContent).toContain("（無効なゲスト）");
  });

  it("shows （非公開のゲスト） without a profile link when the author is hidden", async () => {
    const container = await mount({ review: review({ authorProfileId: "", author: null, authorHidden: true }), variant: "feed" });

    expect(container.textContent).toContain("（非公開のゲスト）");
    expect(container.textContent).not.toContain("（無効なゲスト）");
    expect(Array.from(container.querySelectorAll("a")).some((link) => link.getAttribute("href") === "/u/")).toBe(false);
    expect(container.querySelector('a[href="/u/yuna"]')).toBeNull();
  });

  it("keeps （無効なゲスト） when the author is missing and not hidden", async () => {
    const container = await mount({ review: review({ author: null, authorHidden: false }), variant: "feed" });

    expect(container.textContent).toContain("（無効なゲスト）");
    expect(container.textContent).not.toContain("（非公開のゲスト）");
  });

  it("shows a question mark as the avatar initial when the author is missing", async () => {
    const missing = await mount({ review: review({ author: null }), variant: "feed" });
    const present = await mount({ review: review(), variant: "feed" });

    expect(missing.querySelector(".rounded-full")?.textContent).toBe("?");
    expect(present.querySelector(".rounded-full")?.textContent).toBe("ゆ");
  });

  it("names a missing target as an invalid cast without the handle or a link to the cast", async () => {
    const container = await mount({ review: review({ target: null }), variant: "feed" });

    expect(container.querySelector("button")?.textContent).toContain("（無効なキャスト）");
    expect(container.textContent).not.toContain("@");
    expect(container.textContent).not.toContain("キャストのプロフィールを見る");
    expect(container.querySelector("a[href^='/u/']:not([href='/u/yuna'])")).toBeNull();
  });

  it("marks a private author next to the author name only", async () => {
    const base = review();
    const container = await mount({ review: review({ author: { ...base.author!, isPrivate: true } }), variant: "feed" });

    expect(container.querySelector('p [aria-label="鍵付き"]')).not.toBeNull();
    expect(container.querySelector('button [aria-label="鍵付き"]')).toBeNull();
  });

  it("marks a private target next to the target name only", async () => {
    const base = review();
    const container = await mount({ review: review({ target: { ...base.target!, isPrivate: true } }), variant: "feed" });

    expect(container.querySelector('button [aria-label="鍵付き"]')).not.toBeNull();
    expect(container.querySelector('p > [aria-label="鍵付き"], a [aria-label="鍵付き"]')).toBeNull();
  });

  it("shows no lock mark when neither side is private", async () => {
    const container = await mount({ review: review(), variant: "feed" });

    expect(container.querySelector('[aria-label="鍵付き"]')).toBeNull();
  });
});
