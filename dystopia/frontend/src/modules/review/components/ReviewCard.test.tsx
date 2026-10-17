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
  authorUsername: "yuna",
  authorDisplayName: "ゆな",
  authorAvatarUrl: "",
  targetProfileId: "cast-1",
  targetUsername: "hanako",
  targetDisplayName: "はなこ",
  targetAvatarUrl: "",
  isMine: true,
  rating: null,
  status: "open",
  events: [
    event("e-1"),
    event("e-2", { stage: "service", outcome: "ended_early", tags: ["late", "not_as_pictured", "unagreed_charge"], note: "30分で帰った", occurredOn: "2026-10-14" }),
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
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
  it("summarizes the review with its latest event, state and two tags", async () => {
    const text = (await mount({ review: review(), variant: "feed" })).textContent;

    expect(text).toContain("クチコミ / ゲストからキャストへ");
    expect(text).toContain("ゆな");
    expect(text).toContain("はなこ");
    expect(text).toContain("@hanako");
    expect(text).toContain("未評価");
    expect(text).toContain("10/14 · 利用 · 途中で終了 — 30分で帰った");
    expect(text).toContain("記録中");
    expect(text).toContain("遅刻あり");
    expect(text).toContain("写真・プロフィールと違う");
    expect(text).not.toContain("合意していない料金・要求あり");
  });

  it("shows the rating and the closed state", async () => {
    const text = (await mount({ review: review({ rating: 4, status: "closed", closedAt: new Date().toISOString() }), variant: "feed" })).textContent;

    expect(text).toContain("★ 4.0");
    expect(text).toContain("完了");
    expect(text).not.toContain("記録中");
  });

  it("leaves the dash out when the latest event has no note", async () => {
    const text = (await mount({ review: review({ events: [event("e-1")] }), variant: "feed" })).textContent;

    expect(text).toContain("10/1 · 予約・問い合わせ · 予約成立");
    expect(text).not.toContain(" — ");
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
    const other = await mount({ review: review({ authorProfileId: "persona-b", authorUsername: "yuna_osaka" }), variant: "mine" });
    const deleted = await mount({ review: review({ authorProfileId: "persona-gone", authorUsername: "" }), variant: "mine" });
    const current = await mount({ review: review(), variant: "mine" });

    expect(other.textContent).toContain("@yuna_osaka として記録");
    expect(deleted.textContent).toContain("削除したプロフィールで記録");
    expect(current.textContent).not.toContain("として記録");
  });
});
