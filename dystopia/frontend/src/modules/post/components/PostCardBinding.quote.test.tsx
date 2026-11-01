// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView, QuotedPostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { useQuoteComposeStore } from "@/stores/quoteComposeStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/modules/bookmarks", () => ({
  useBookmark: () => ({ isBookmarked: false, toggle: vi.fn(), loading: false }),
}));
vi.mock("@/modules/post/hooks/usePostLike", () => ({
  usePostLike: () => ({ isLiked: () => false, getLikesCount: () => 0, toggleLike: vi.fn(), loading: false }),
}));

const { PostCardBinding } = await import("./PostCardBinding");

const post: PostView = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "こんにちは",
  media: [],
  createdAt: new Date().toISOString(),
  publishedAt: new Date(Date.now() - 60 * 1000).toISOString(),
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
  quotesCount: 2,
};

const quoted: QuotedPostView = {
  available: true,
  id: "quoted-1",
  author: { profileId: "author-2", displayName: "引用元花子", username: "hanako", avatarUrl: "", isPrivate: false, role: null, industry: "" },
  content: "引用元の本文",
  media: [],
  publishedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  schedule: null,
  mentions: [],
  hashtags: [],
};

const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  useQuoteComposeStore.setState({ post: null, session: 0, open: false });
  document.addEventListener("click", stopNavigation);
});

afterEach(() => {
  document.removeEventListener("click", stopNavigation);
  document.body.innerHTML = "";
});

async function mount(props: { inDetail?: boolean; post?: PostView; hideQuoteFrame?: boolean } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostCardBinding, { post, ...props }));
  });
  return container;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
}

const quoteButton = (container: Element) => container.querySelector<HTMLButtonElement>('button[aria-label="引用する"]')!;

describe("PostCardBinding quote icon", () => {
  it("shows the Repeat2 icon and the quote count after the comment count, with no text label", async () => {
    const container = await mount();
    const comment = container.querySelector('a[aria-label="コメント"]')!;
    const button = quoteButton(container);
    const count = container.querySelector('a[aria-label="引用 2 件"]')!;

    expect(button.querySelector("svg.lucide-repeat-2")).not.toBeNull();
    expect(button.textContent).toBe("");
    expect(count.textContent).toBe("2");
    expect(comment.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("min-w-11");
    expect(count.className).toContain("min-h-11");
    expect(count.className).toContain("min-w-11");
  });

  it("opens the quote composer from the icon", async () => {
    const container = await mount();

    await click(quoteButton(container));

    expect(useQuoteComposeStore.getState()).toMatchObject({ post, open: true });
  });

  it("closes the open detail sheet and opens the composer once its history entry is gone", async () => {
    usePostSheetStore.setState({ postId: "post-1", session: 1, open: true });
    const container = await mount({ inDetail: true });

    await click(quoteButton(container));

    expect(usePostSheetStore.getState().open).toBe(false);
    expect(useQuoteComposeStore.getState().open).toBe(false);

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(useQuoteComposeStore.getState()).toMatchObject({ post, open: true });

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(useQuoteComposeStore.getState().session).toBe(1);
  });

  it("links the count to the quotes tab of the post", async () => {
    const container = await mount();

    expect(container.querySelector('a[aria-label="引用 2 件"]')?.getAttribute("href")).toBe("/posts/post-1?tab=quotes");
  });

  it("shows the count as text inside the detail", async () => {
    const container = await mount({ inDetail: true });

    expect(container.querySelector('a[aria-label="引用 2 件"]')).toBeNull();
    expect(container.querySelector('span[aria-label="引用 2 件"]')?.textContent).toBe("2");
  });

  it.each([
    ["followers-only", { visibility: "private" as const }],
    ["scheduled", { publishedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
    ["expired", { expiresAt: new Date(Date.now() - 60 * 1000).toISOString() }],
  ])("disables the icon but keeps the count pressable on a %s post", async (_name, overrides) => {
    const container = await mount({ post: { ...post, ...overrides } });

    expect(quoteButton(container).disabled).toBe(true);
    expect(quoteButton(container).className).toContain("disabled:opacity-50");
    expect(container.querySelector('a[aria-label="引用 2 件"]')?.getAttribute("href")).toBe("/posts/post-1?tab=quotes");

    await click(quoteButton(container));

    expect(useQuoteComposeStore.getState().open).toBe(false);
  });

  it("keeps the icon pressable on a public post that is live", async () => {
    const container = await mount();

    expect(quoteButton(container).disabled).toBe(false);
  });
});

describe("PostCardBinding quote frame", () => {
  it("shows the frame on a quote post and hides it with hideQuoteFrame", async () => {
    const quotePost = { ...post, quotedPost: quoted };

    const shown = await mount({ post: quotePost });
    expect(shown.textContent).toContain("引用元の本文");
    expect(shown.querySelector('a[href="/posts/quoted-1"]')).not.toBeNull();
    document.body.innerHTML = "";

    const hidden = await mount({ post: quotePost, hideQuoteFrame: true });
    expect(hidden.textContent).not.toContain("引用元の本文");
  });

  it("shows no frame on a post that quotes nothing", async () => {
    const container = await mount();

    expect(container.querySelector('a[href="/posts/quoted-1"]')).toBeNull();
  });

  it("places the frame below the images and above the reactions", async () => {
    const container = await mount({
      post: {
        ...post,
        quotedPost: quoted,
        media: [{ id: "m1", mediaType: "image", url: "https://example.com/full.jpg", thumbnailUrl: "https://example.com/thumb.jpg", mediaId: "media-1" }],
      },
    });
    const ownImage = container.querySelector('button[aria-label="画像を拡大"]')!;
    const frame = container.querySelector('a[href="/posts/quoted-1"]')!;
    const reaction = container.querySelector('button[aria-label="いいね"]')!;

    expect(ownImage.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(frame.compareDocumentPosition(reaction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
