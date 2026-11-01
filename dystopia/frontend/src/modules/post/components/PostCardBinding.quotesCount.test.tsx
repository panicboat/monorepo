// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";

const fetcherMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/lib/swr", () => ({ fetcher: (...args: unknown[]) => fetcherMock(...args) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { activeProfileId: string }) => unknown) =>
    selector({ activeProfileId: "profile-1" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));
vi.mock("@/modules/bookmarks", () => ({
  useBookmark: () => ({ isBookmarked: false, toggle: vi.fn(), loading: false }),
}));
vi.mock("@/modules/post/hooks/usePostLike", () => ({
  usePostLike: () => ({
    isLiked: (_id: string, fallback = false) => fallback,
    getLikesCount: (_id: string, fallback = 0) => fallback,
    toggleLike: vi.fn(),
    loading: false,
  }),
}));

const { PostCardBinding } = await import("./PostCardBinding");
const { usePost } = await import("../hooks/usePost");
const { usePostQuoteCountStore } = await import("@/stores/postQuoteCountStore");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const feedPost: PostView = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "こんにちは",
  media: [],
  createdAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
  expiresAt: "",
  author: { profileId: "author-1", displayName: "テスト太郎", username: "test_taro", avatarUrl: "", isPrivate: false, role: null, industry: "" },
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
  pinned: false,
  quotedPost: null,
  quotesCount: 2,
};

let serverCount: number;
let root: Root;
let container: HTMLElement;
const actions: { refetch?: () => Promise<unknown> } = {};

function DetailProbe() {
  actions.refetch = usePost("post-1").mutate;
  return null;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

const feedCardCount = () => container.querySelector('a[aria-label^="引用 "]')?.textContent;

beforeEach(async () => {
  usePostQuoteCountStore.setState({ counts: {} });
  serverCount = 2;
  fetcherMock.mockReset().mockImplementation(async () => ({ post: { ...feedPost, quotesCount: serverCount } }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wrapper = (children: ReactNode) =>
    createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  await act(async () => {
    root.render(wrapper(createElement("div", null, createElement(PostCardBinding, { post: feedPost }), createElement(DetailProbe))));
  });
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("PostCardBinding quote count", () => {
  it("shows one more on a feed card as soon as a quote is added", async () => {
    expect(feedCardCount()).toBe("2");

    await act(async () => usePostQuoteCountStore.getState().addOne("post-1", feedPost.quotesCount));

    expect(feedCardCount()).toBe("3");
  });

  it("replaces the added count with the count fetched for the detail", async () => {
    await act(async () => usePostQuoteCountStore.getState().addOne("post-1", feedPost.quotesCount));
    expect(feedCardCount()).toBe("3");

    serverCount = 5;
    await act(async () => { await actions.refetch?.(); });
    await flush();

    expect(feedCardCount()).toBe("5");
  });
});
