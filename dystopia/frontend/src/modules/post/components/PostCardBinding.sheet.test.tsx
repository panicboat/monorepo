// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { PostCardBinding } from "./PostCardBinding";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const post: PostView = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "こんにちは",
  media: [],
  createdAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
  expiresAt: "",
  author: { profileId: "author-1", displayName: "テスト太郎", username: "test_taro", avatarUrl: "", isPrivate: false, role: null, industry: "" },
  likesCount: 0,
  commentsCount: 3,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
  pinned: false,
  quotedPost: null,
  quotesCount: 0,
};

const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  document.addEventListener("click", stopNavigation);
});

afterEach(() => {
  document.removeEventListener("click", stopNavigation);
  document.body.innerHTML = "";
});

async function mount(props: { inDetail?: boolean; post?: PostView; onCommentClick?: () => void } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostCardBinding, { post, ...props }));
  });
  return container;
}

async function click(element: Element, init: MouseEventInit = {}) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
  });
}

describe("PostCardBinding opening the detail", () => {
  it("opens the sheet to comment from the comment icon and its count", async () => {
    const container = await mount();
    const comment = container.querySelector('a[aria-label="コメント"]')!;

    await click(comment.querySelector("svg")!);
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true, focusComment: true, session: 1 });

    await click(comment.querySelector("span")!);
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true, focusComment: true, session: 2 });
  });

  it("opens the sheet from the body", async () => {
    const container = await mount();

    await click(container.querySelector('a[href="/posts/post-1"]:not([aria-label])')!);

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true, focusComment: false });
  });

  it("leaves a modified click to the link", async () => {
    const container = await mount();

    await click(container.querySelector('a[aria-label="コメント"]')!, { metaKey: true });
    await click(container.querySelector('a[aria-label="コメント"]')!, { ctrlKey: true });

    expect(usePostSheetStore.getState().open).toBe(false);
  });

  it("does not link to the detail inside the detail", async () => {
    const container = await mount({ inDetail: true });

    expect(container.querySelector('a[href="/posts/post-1"]')).toBeNull();
    expect(container.querySelector('button[aria-label="コメント"]')?.textContent).toBe("3");
  });

  it("calls back from the comment button inside the detail", async () => {
    const onCommentClick = vi.fn();
    const container = await mount({ inDetail: true, onCommentClick });

    await click(container.querySelector('button[aria-label="コメント"] span')!);

    expect(onCommentClick).toHaveBeenCalledTimes(1);
    expect(usePostSheetStore.getState().open).toBe(false);
  });
});

describe("PostCardBinding author lock mark", () => {
  it("shows the lock mark for a private author", async () => {
    const container = await mount({ post: { ...post, author: { ...post.author!, isPrivate: true } } });

    expect(container.querySelector('[aria-label="鍵付き"]')).not.toBeNull();
  });

  it("shows no lock mark for a public author", async () => {
    const container = await mount();

    expect(container.querySelector('[aria-label="鍵付き"]')).toBeNull();
  });
});
