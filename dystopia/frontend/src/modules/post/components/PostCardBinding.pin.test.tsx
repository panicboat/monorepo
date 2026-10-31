// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostListRevalidation } from "@/modules/post/lib/revalidate";
import { usePostPinStore } from "@/stores/postPinStore";
import { useToastStore } from "@/stores/toastStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), activeProfileId: "author-1" as string | null }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { activeProfileId: string | null }) => unknown) => selector({ activeProfileId: mocks.activeProfileId }),
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
}));
vi.mock("@/modules/bookmarks", () => ({
  useBookmark: () => ({ isBookmarked: false, toggle: vi.fn(), loading: false }),
}));
vi.mock("@/modules/post/hooks/usePostLike", () => ({
  usePostLike: () => ({ isLiked: () => false, getLikesCount: () => 0, toggleLike: vi.fn(), loading: false }),
}));

const { PostCardBinding } = await import("./PostCardBinding");

const postOf = (id: string, pinned: boolean) =>
  ({
    id,
    authorProfileId: "author-1",
    content: `本文-${id}`,
    media: [],
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    expiresAt: "",
    author: null,
    likesCount: 0,
    commentsCount: 0,
    visibility: "public",
    hashtags: [],
    mentions: [],
    liked: false,
    schedule: null,
    pinned,
  }) as unknown as PostView;

async function mount(...cards: { post: PostView; showPinMark?: boolean }[]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map() } },
        cards.map((card) => createElement(PostCardBinding, { key: card.post.id, ...card }))
      )
    );
  });
  return container;
}

const pinButtons = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label="ピン留めする"], button[aria-label="ピン留めを外す"]'));

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue({});
  mocks.activeProfileId = "author-1";
  usePostPinStore.setState({ pinnedPostIdByAuthor: {} });
  useToastStore.setState({ message: null });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("PostCardBinding pinning a post", () => {
  it("offers pinning only on the viewer's own post", async () => {
    expect(pinButtons(await mount({ post: postOf("post-1", false) }))).toHaveLength(1);

    mocks.activeProfileId = "viewer-1";
    expect(pinButtons(await mount({ post: postOf("post-1", false) }))).toHaveLength(0);

    mocks.activeProfileId = null;
    expect(pinButtons(await mount({ post: postOf("post-1", false) }))).toHaveLength(0);
  });

  it("pins an unpinned post", async () => {
    const container = await mount({ post: postOf("post-1", false) });

    await act(async () => pinButtons(container)[0].click());

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/posts/post-1/pin", { method: "POST" });
    expect(pinButtons(container)[0].getAttribute("aria-label")).toBe("ピン留めを外す");
    expect(pinButtons(container)[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("unpins a pinned post", async () => {
    const container = await mount({ post: postOf("post-1", true) });

    await act(async () => pinButtons(container)[0].click());

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/posts/post-1/pin", { method: "DELETE" });
    expect(pinButtons(container)[0].getAttribute("aria-label")).toBe("ピン留めする");
  });

  it("moves the pin on every card of the author when another post is pinned", async () => {
    const container = await mount({ post: postOf("post-1", true) }, { post: postOf("post-2", false) });

    await act(async () => pinButtons(container)[1].click());

    expect(pinButtons(container).map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
  });

  it("refreshes the author lists so the post moves to the top", async () => {
    const refresh = vi.fn();
    const Registered = () => {
      usePostListRevalidation(refresh);
      return null;
    };
    const container = await mount({ post: postOf("post-1", false) });
    await act(async () => {
      createRoot(document.createElement("div")).render(createElement(Registered));
    });

    await act(async () => pinButtons(container)[0].click());

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the state and tells the viewer when pinning fails", async () => {
    mocks.authFetch.mockRejectedValue(new Error("boom"));
    const container = await mount({ post: postOf("post-1", false) });

    await act(async () => pinButtons(container)[0].click());

    expect(pinButtons(container)[0].getAttribute("aria-pressed")).toBe("false");
    expect(useToastStore.getState().message).toBe("ピン留めを変更できませんでした");
  });
});

describe("PostCardBinding pin mark", () => {
  it.each([
    ["a pinned post in a list that shows the mark", true, true, true],
    ["a pinned post in a list without the mark", true, false, false],
    ["an unpinned post", false, true, false],
  ])("for %s", async (_name, pinned, showPinMark, expected) => {
    mocks.activeProfileId = "viewer-1";
    const container = await mount({ post: postOf("post-1", pinned), showPinMark });

    expect(container.textContent?.includes("ピン留めされた投稿")).toBe(expected);
  });

  it("drops the mark as soon as the author unpins", async () => {
    const container = await mount({ post: postOf("post-1", true), showPinMark: true });
    expect(container.textContent).toContain("ピン留めされた投稿");

    await act(async () => pinButtons(container)[0].click());

    expect(container.textContent).not.toContain("ピン留めされた投稿");
  });
});
