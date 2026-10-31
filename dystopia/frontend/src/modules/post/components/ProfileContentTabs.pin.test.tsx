// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pinnedPost = vi.hoisted(() => ({
  id: "post-1",
  authorProfileId: "author-1",
  content: "自己紹介",
  media: [],
  createdAt: "2026-11-01T00:00:00Z",
  publishedAt: "2026-11-01T00:00:00Z",
  expiresAt: "",
  author: null,
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
  pinned: true,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/lib/motion/useEnterAnimation", () => ({ useEnterAnimation: () => {} }));
vi.mock("@/modules/bookmarks", () => ({
  useBookmark: () => ({ isBookmarked: false, toggle: vi.fn(), loading: false }),
}));
vi.mock("@/modules/post/hooks/useAuthorPosts", () => ({
  useAuthorPosts: () => ({ posts: [pinnedPost], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
}));
vi.mock("@/modules/post/hooks/useAuthorLikedPosts", () => ({
  useAuthorLikedPosts: () => ({ posts: [pinnedPost], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
}));

const { ProfileContentTabs } = await import("./ProfileContentTabs");

async function renderTab(initialTab: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(ProfileContentTabs, { profileId: "author-1", initialTab }));
  });
  return container;
}

describe("ProfileContentTabs pin mark", () => {
  it.each([
    ["posts", true],
    ["media", false],
    ["likes", false],
  ])("on the %s tab shows the mark: %s", async (tab, expected) => {
    const container = await renderTab(tab);

    expect(container.textContent).toContain("自己紹介");
    expect(container.textContent?.includes("ピン留めされた投稿")).toBe(expected);
  });
});
