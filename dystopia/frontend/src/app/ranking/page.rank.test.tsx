// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/discovery", () => ({
  useRankPosts: () => ({ posts: [{ id: "a" }, { id: "b" }], hasMore: false, loading: false, loadMore: vi.fn() }),
}));
vi.mock("@/modules/post/components/PostCardBinding", () => ({
  PostCardBinding: ({ post }: { post: { id: string } }) => <div>post:{post.id}</div>,
}));

const { default: RankingPage } = await import("./page");

describe("RankingPage", () => {
  it("ranks each post with the selected period", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(RankingPage));
    });

    expect(container.textContent).toContain("#1 · 1週間の人気投稿");
    expect(container.textContent).toContain("#2 · 1週間の人気投稿");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "24h") as HTMLElement).click();
    });

    expect(container.textContent).toContain("#1 · 24時間の人気投稿");
  });
});
