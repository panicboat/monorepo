// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostDeletionStore } from "@/stores/postDeletionStore";
import { usePostSheetStore } from "@/stores/postSheetStore";
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

const post = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "こんにちは",
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
} as unknown as PostView;

async function mount(props: { inDetail?: boolean } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      createElement(SWRConfig, { value: { provider: () => new Map() } }, createElement(PostCardBinding, { post, ...props }))
    );
  });
  return container;
}

const deleteButton = (container: Element) => container.querySelector<HTMLButtonElement>('button[aria-label="投稿を削除"]');

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue({});
  mocks.activeProfileId = "author-1";
  usePostDeletionStore.setState({ deleted: {} });
  usePostSheetStore.setState({ postId: "post-1", session: 1, open: true });
  vi.stubGlobal("confirm", () => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("PostCardBinding deleting a post", () => {
  it("offers deleting only on the viewer's own post", async () => {
    expect(deleteButton(await mount())).not.toBeNull();

    mocks.activeProfileId = "viewer-1";
    expect(deleteButton(await mount())).toBeNull();

    mocks.activeProfileId = null;
    expect(deleteButton(await mount())).toBeNull();
  });

  it("does nothing when the confirmation is declined", async () => {
    vi.stubGlobal("confirm", () => false);
    const container = await mount();

    await act(async () => deleteButton(container)!.click());

    expect(mocks.authFetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("こんにちは");
  });

  it("deletes the post and hides the card", async () => {
    const container = await mount();

    await act(async () => deleteButton(container)!.click());

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/posts/post-1", { method: "DELETE" });
    expect(container.textContent).not.toContain("こんにちは");
    expect(usePostSheetStore.getState().open).toBe(true);
  });

  it("closes the detail sheet after deleting from the detail", async () => {
    const container = await mount({ inDetail: true });

    await act(async () => deleteButton(container)!.click());

    expect(usePostSheetStore.getState().open).toBe(false);
  });

  it("keeps the card and tells the viewer when deleting fails", async () => {
    mocks.authFetch.mockRejectedValue(new Error("boom"));
    const show = vi.spyOn(useToastStore.getState(), "show");
    useToastStore.setState({ show });
    const container = await mount();

    await act(async () => deleteButton(container)!.click());

    expect(container.textContent).toContain("こんにちは");
    expect(show).toHaveBeenCalledWith("投稿を削除できませんでした");
  });
});
