import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/bookmarks", () => ({
  useBookmarkList: () => ({ posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
}));
vi.mock("@/modules/post/components/PostCardBinding", () => ({ PostCardBinding: () => null }));

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
    const html = renderToStaticMarkup(<BookmarksPage />);

    expect(html).toContain("まだブックマークがありません");
    expect(html).toContain("投稿のしおりアイコンから追加できます。");
  });
});
