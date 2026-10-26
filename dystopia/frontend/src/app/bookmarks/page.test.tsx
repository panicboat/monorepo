// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  items: [] as { postId: string; post: { id: string } | null }[],
  hasMore: false,
  refresh: vi.fn(),
  authFetch: vi.fn(async () => ({})),
}));

vi.mock("@/modules/bookmarks", () => ({
  useBookmarkList: () => ({ items: state.items, hasMore: state.hasMore, loading: false, error: undefined, loadMore: vi.fn(), refresh: state.refresh }),
}));
vi.mock("@/modules/post/components/PostCardBinding", () => ({ PostCardBinding: ({ post }: { post: { id: string } }) => <span>post:{post.id}</span> }));
vi.mock("@/lib/auth", () => ({ authFetch: state.authFetch }));

const { default: BookmarksPage, BookmarksHeader } = await import("./page");

describe("BookmarksHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<BookmarksHeader />);

    expect(html).toContain("ブックマーク");
    expect(html).toContain("保存した投稿の一覧");
  });
});

describe("BookmarksPage", () => {
  it("tells how to add a bookmark when there is none", () => {
    state.items = [];
    state.hasMore = false;
    const html = renderToStaticMarkup(<BookmarksPage />);

    expect(html).toContain("まだブックマークがありません");
    expect(html).toContain("投稿のしおりアイコンから追加できます。");
  });

  it("does not say there is none while more bookmarks remain to be read", () => {
    state.items = [];
    state.hasMore = true;
    const html = renderToStaticMarkup(<BookmarksPage />);

    expect(html).not.toContain("まだブックマークがありません");
    expect(html).toContain("もっと見る");
  });

  it("lists a bookmark whose post cannot be shown and removes it from there", async () => {
    state.items = [{ postId: "p-1", post: { id: "p-1" } }, { postId: "p-2", post: null }];
    state.hasMore = false;
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(BookmarksPage));
    });

    expect(container.textContent).toContain("post:p-1");
    expect(container.textContent).toContain("この投稿は表示できません");
    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "ブックマークを外す") as HTMLButtonElement).click();
    });

    expect(state.authFetch).toHaveBeenCalledWith("/api/bookmarks/p-2", { method: "DELETE" });
    expect(state.refresh).toHaveBeenCalled();
  });
});
