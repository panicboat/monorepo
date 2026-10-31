// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";

const fetcherMock = vi.fn();
const authFetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/lib/swr", () => ({ fetcher: (...args: unknown[]) => fetcherMock(...args) }));
vi.mock("@/lib/auth", () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args) }));
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
const { useAddComment } = await import("../hooks/useAddComment");
const { useDeleteComment } = await import("../hooks/useDeleteComment");
const { usePostCommentCountStore } = await import("@/stores/postCommentCountStore");

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
  commentsCount: 3,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
};

let serverCount: number;
let root: Root;
let container: HTMLElement;
const actions: {
  add?: (content: string) => Promise<void>;
  del?: (commentId: string) => Promise<void>;
} = {};

function DetailProbe() {
  usePost("post-1");
  actions.add = useAddComment("post-1").addComment;
  actions.del = useDeleteComment("post-1").deleteComment;
  return null;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

const feedCardCount = () =>
  container.querySelector('a[aria-label="コメント"]')?.textContent;

beforeEach(async () => {
  usePostCommentCountStore.setState({ counts: {} });
  authFetchMock.mockReset().mockResolvedValue({});
  fetcherMock.mockReset().mockImplementation(async () => ({ post: { ...feedPost, commentsCount: serverCount } }));
  serverCount = 3;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wrapper = (children: ReactNode) =>
    createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  await act(async () => {
    root.render(
      wrapper(
        createElement("div", null, createElement(PostCardBinding, { post: feedPost }), createElement(DetailProbe))
      )
    );
  });
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("PostCardBinding comment count", () => {
  it("shows the server count on a feed card after a comment is added in the detail", async () => {
    expect(feedCardCount()).toBe("3");

    serverCount = 4;
    await act(async () => { await actions.add?.("hi"); });
    await flush();

    expect(feedCardCount()).toBe("4");
  });

  it("shows the server count on a feed card after a comment is deleted in the detail", async () => {
    serverCount = 2;
    await act(async () => { await actions.del?.("c1"); });
    await flush();

    expect(feedCardCount()).toBe("2");
  });
});
