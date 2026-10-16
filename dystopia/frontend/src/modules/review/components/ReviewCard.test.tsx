// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ReviewEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const viewer = vi.hoisted(() => ({ id: "someone" }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: viewer.id }),
}));

const { ReviewCard } = await import("./ReviewCard");

const entry = (overrides: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id: "r-1",
  authorProfileId: "guest-1",
  targetProfileId: "cast-1",
  authorUsername: "hanako",
  authorAvatarUrl: "",
  targetUsername: "yuna",
  targetAvatarUrl: "",
  rating: 4,
  body: "とても丁寧でした",
  hidden: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

async function mount(props: { entry: ReviewEntry; variant: "feed" | "target" | "author"; onOpen?: (e: ReviewEntry) => void }) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(ReviewCard, { onOpen: vi.fn(), ...props }));
  });
  return container;
}

describe("ReviewCard", () => {
  it("summarizes the review and opens it", async () => {
    const onOpen = vi.fn();
    const subject = entry();
    const container = await mount({ entry: subject, variant: "feed", onOpen });

    expect(container.textContent).toContain("REVIEW / ゲストからキャストへ");
    expect(container.textContent).toContain("@hanako");
    expect(container.textContent).toContain("@yuna");
    expect(container.textContent).toContain("★ 4.0");
    expect(container.textContent).toContain("とても丁寧でした");
    expect(container.textContent).toContain("ゲストによるレビュー");
    expect(container.querySelector('a[href="/u/yuna"]')?.textContent).toBe("キャストのプロフィールを見る →");

    (container.querySelector("button") as HTMLButtonElement).click();
    expect(onOpen).toHaveBeenCalledWith(subject);
  });

  it("leaves out the cast link on the cast's own reviews", async () => {
    const container = await mount({ entry: entry(), variant: "target" });

    expect(container.textContent).not.toContain("キャストのプロフィールを見る");
  });

  it("marks a hidden review only for the cast it is about", async () => {
    viewer.id = "cast-1";
    const forTarget = await mount({ entry: entry({ hidden: true }), variant: "target" });
    viewer.id = "someone";
    const forOthers = await mount({ entry: entry({ hidden: true }), variant: "feed" });

    expect(forTarget.textContent).toContain("非表示中");
    expect(forOthers.textContent).not.toContain("非表示中");
  });
});
