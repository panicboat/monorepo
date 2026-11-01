// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useQuotes: vi.fn(),
  cards: [] as { id: string; hideQuoteFrame?: boolean }[],
}));

vi.mock("@/modules/post/hooks/useQuotes", () => ({ useQuotes: mocks.useQuotes }));
vi.mock("./PostCardBinding", () => ({
  PostCardBinding: ({ post, hideQuoteFrame }: { post: { id: string }; hideQuoteFrame?: boolean }) => {
    mocks.cards.push({ id: post.id, hideQuoteFrame });
    return <div>card:{post.id}</div>;
  },
}));

const { QuoteList } = await import("./QuoteList");

const loadMore = vi.fn();

function quotes(overrides: Partial<ReturnType<typeof mocks.useQuotes>> = {}) {
  mocks.useQuotes.mockReturnValue({ posts: [], hasMore: false, loading: false, error: undefined, loadMore, ...overrides });
}

beforeEach(() => {
  mocks.cards = [];
  loadMore.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(QuoteList, { postId: "post-1" }));
  });
  return container;
}

describe("QuoteList", () => {
  it("lists quote posts as cards without the frame", async () => {
    quotes({ posts: [{ id: "quote-1" }, { id: "quote-2" }] });

    const container = await mount();

    expect(mocks.useQuotes).toHaveBeenCalledWith("post-1");
    expect(container.textContent).toContain("card:quote-1");
    expect(container.textContent).toContain("card:quote-2");
    expect(mocks.cards).toEqual([
      { id: "quote-1", hideQuoteFrame: true },
      { id: "quote-2", hideQuoteFrame: true },
    ]);
  });

  it("says まだ引用はありません when empty", async () => {
    quotes();

    expect((await mount()).textContent).toContain("まだ引用はありません");
  });

  it("says it is loading while the first page loads", async () => {
    quotes({ loading: true });

    const container = await mount();

    expect(container.textContent).toContain("読み込み中…");
    expect(container.textContent).not.toContain("まだ引用はありません");
  });

  it("says it failed to load when the request fails", async () => {
    quotes({ error: new Error("boom") });

    expect((await mount()).textContent).toContain("読み込みに失敗しました");
  });

  it("loads more with もっと見る when there are more quotes", async () => {
    quotes({ posts: [{ id: "quote-1" }], hasMore: true });

    const container = await mount();
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "もっと見る")!;
    await act(async () => button.click());

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("shows no もっと見る on the last page", async () => {
    quotes({ posts: [{ id: "quote-1" }], hasMore: false });

    expect((await mount()).textContent).not.toContain("もっと見る");
  });
});
