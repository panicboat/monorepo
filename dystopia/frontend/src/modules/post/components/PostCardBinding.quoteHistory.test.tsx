// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { SideSheet } from "@/components/ui/side-sheet";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { useQuoteComposeStore } from "@/stores/quoteComposeStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }));
vi.mock("@/modules/bookmarks", () => ({
  useBookmark: () => ({ isBookmarked: false, toggle: vi.fn(), loading: false }),
}));
vi.mock("@/modules/post/hooks/usePostLike", () => ({
  usePostLike: () => ({ isLiked: () => false, getLikesCount: () => 0, toggleLike: vi.fn(), loading: false }),
}));
vi.mock("./PostComposer", () => ({ PostComposer: () => null }));

const { PostCardBinding } = await import("./PostCardBinding");
const { QuoteComposerSheet } = await import("./QuoteComposerSheet");

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
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
  pinned: false,
  quotedPost: null,
  quotesCount: 0,
};

function DetailSheet() {
  const open = usePostSheetStore((s) => s.open);
  const close = usePostSheetStore((s) => s.close);
  return (
    <SideSheet open={open} onOpenChange={(next) => { if (!next) close(); }} title="投稿の詳細">
      <PostCardBinding post={post} inDetail />
    </SideSheet>
  );
}

let root: Root;
let container: HTMLElement;
let backSpy: MockInstance<() => void>;

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const openDialogTitles = () => Array.from(document.querySelectorAll('[role="dialog"] h2')).map((title) => title.textContent);
const marker = () => (window.history.state as { sideSheet?: number } | null)?.sideSheet;

beforeEach(async () => {
  // happy-dom traverses at once while a browser queues the traversal, so defer it to see the order a browser produces.
  const traverse = window.history.back.bind(window.history);
  backSpy = vi.spyOn(window.history, "back").mockImplementation(() => void setTimeout(traverse, 0));
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  useQuoteComposeStore.setState({ post: null, session: 0, open: false });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <>
        <PostCardBinding post={post} />
        <DetailSheet />
        <QuoteComposerSheet />
      </>
    )
  );
});

afterEach(async () => {
  backSpy.mockRestore();
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("PostCardBinding quote icon with the real sheets", () => {
  it("swaps the open detail for the composer and keeps the composer open through the history traversal", async () => {
    const entries = window.history.length;
    await act(async () => usePostSheetStore.getState().openPost("post-1"));
    const entriesWithDetail = window.history.length;
    expect(entriesWithDetail).toBe(entries + 1);
    expect(openDialogTitles()).toEqual(["投稿の詳細"]);

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="引用する"]')!.click();
    });
    await settle();
    await settle();

    expect(openDialogTitles()).toEqual(["引用して投稿"]);
    expect(usePostSheetStore.getState().open).toBe(false);
    expect(useQuoteComposeStore.getState().open).toBe(true);
    expect(window.history.length).toBeLessThanOrEqual(entriesWithDetail + 1);
    expect(marker()).toBeTypeOf("number");
  });

  it("opens the composer at once from a card outside the detail", async () => {
    const entries = window.history.length;

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="引用する"]')!.click();
    });

    expect(openDialogTitles()).toEqual(["引用して投稿"]);
    expect(window.history.length).toBeLessThanOrEqual(entries + 1);
    expect(marker()).toBeTypeOf("number");
  });
});
