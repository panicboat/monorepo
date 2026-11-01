// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePostCommentCountStore } from "@/stores/postCommentCountStore";
import { usePostQuoteCountStore } from "@/stores/postQuoteCountStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  usePost: vi.fn(),
  cardProps: null as null | { inDetail?: boolean },
}));

vi.mock("../hooks/usePost", () => ({ usePost: mocks.usePost }));
vi.mock("./PostCardBinding", () => ({
  PostCardBinding: (props: { inDetail?: boolean }) => {
    mocks.cardProps = props;
    return <div>post-card</div>;
  },
}));
vi.mock("./CommentComposer", () => ({
  CommentComposer: ({ postId }: { postId: string }) => {
    const [draft, setDraft] = useState("");
    return (
      <div>
        composer:{postId}
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
      </div>
    );
  },
}));
vi.mock("./CommentList", () => ({ CommentList: ({ postId }: { postId: string }) => <div>comments:{postId}</div> }));
vi.mock("./QuoteList", () => ({ QuoteList: ({ postId }: { postId: string }) => <div>quotes:{postId}</div> }));

const { PostDetailContent } = await import("./PostDetailContent");

const post = { id: "post-1", commentsCount: 2, quotesCount: 3 };

beforeEach(() => {
  mocks.cardProps = null;
  usePostCommentCountStore.setState({ counts: {} });
  usePostQuoteCountStore.setState({ counts: {} });
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(props: { initialTab?: "comments" | "quotes" } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostDetailContent, { postId: "post-1", ...props }));
  });
  return container;
}

const tabButton = (container: Element, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === label)!;

describe("PostDetailContent", () => {
  it("shows the post without detail links, then the comments", () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });

    const html = renderToStaticMarkup(<PostDetailContent postId="post-1" />);

    expect(mocks.usePost).toHaveBeenCalledWith("post-1");
    expect(mocks.cardProps?.inDetail).toBe(true);
    expect(html).toContain("composer:post-1");
    expect(html).toContain("comments:post-1");
  });

  it("opens the comments tab by default and shows the counts in the tab labels", async () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });

    const container = await mount();

    expect(tabButton(container, "コメント 2").getAttribute("aria-selected")).toBe("true");
    expect(tabButton(container, "引用 3").getAttribute("aria-selected")).toBe("false");
  });

  it("prefers the comment count store over the post's count in the tab label", async () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });
    usePostCommentCountStore.setState({ counts: { "post-1": 5 } });

    const container = await mount();

    expect(tabButton(container, "コメント 5")).toBeDefined();
  });

  it("prefers the quote count store over the post's count in the tab label", async () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });
    usePostQuoteCountStore.setState({ counts: { "post-1": 6 } });

    const container = await mount();

    expect(tabButton(container, "引用 6")).toBeDefined();
  });

  it("opens the quotes tab with initialTab", async () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });

    const container = await mount({ initialTab: "quotes" });

    expect(tabButton(container, "引用 3").getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("quotes:post-1");
  });

  it("shows the composer and comments in the comments tab and the quotes in the quotes tab", async () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });

    const container = await mount();
    const comments = () => container.querySelector("[hidden]");
    expect(comments()).toBeNull();
    expect(container.textContent).toContain("composer:post-1");
    expect(container.textContent).toContain("comments:post-1");
    expect(container.textContent).not.toContain("quotes:post-1");

    await act(async () => tabButton(container, "引用 3").click());
    expect(comments()?.textContent).toContain("composer:post-1");
    expect(comments()?.textContent).toContain("comments:post-1");
    expect(comments()?.textContent).not.toContain("quotes:post-1");
    expect(container.textContent).toContain("quotes:post-1");

    await act(async () => tabButton(container, "コメント 2").click());
    expect(comments()).toBeNull();
    expect(container.textContent).not.toContain("quotes:post-1");
  });

  it("keeps a comment draft across a switch to the quotes tab and back", async () => {
    mocks.usePost.mockReturnValue({ post, loading: false, error: undefined });
    const container = await mount();
    const textarea = () => container.querySelector("textarea") as HTMLTextAreaElement;

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea(), "書きかけのコメント");
      textarea().dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => tabButton(container, "引用 3").click());
    await act(async () => tabButton(container, "コメント 2").click());

    expect(textarea().value).toBe("書きかけのコメント");
  });

  it("says it is loading and that a missing post was not found", () => {
    mocks.usePost.mockReturnValue({ post: null, loading: true, error: undefined });
    expect(renderToStaticMarkup(<PostDetailContent postId="post-1" />)).toContain("読み込み中…");

    mocks.usePost.mockReturnValue({ post: null, loading: false, error: new Error("not found") });
    expect(renderToStaticMarkup(<PostDetailContent postId="post-1" />)).toContain("投稿が見つかりませんでした。");
  });
});
