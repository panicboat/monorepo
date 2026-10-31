// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { CommentView } from "@/modules/post/lib/comment-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string | null }) => unknown) => selector({ activeProfileId: "viewer-1" }),
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
}));
vi.mock("@/modules/post/hooks/useComments", () => ({
  useComments: () => ({
    comments: [{ id: "comment-1", authorProfileId: "author-1", content: "こんにちは", media: [], mentions: [], createdAt: new Date().toISOString(), repliesCount: 2, author: null, parentId: "" } as unknown as CommentView],
    hasMore: false,
    loading: false,
    error: undefined,
    loadMore: vi.fn(),
  }),
}));
vi.mock("@/modules/post/hooks/useDeleteComment", () => ({
  useDeleteComment: () => ({ deleteComment: vi.fn(), submitting: false }),
}));
vi.mock("./ReplyList", () => ({ ReplyList: () => <p>reply-list</p> }));

const { CommentList } = await import("./CommentList");

const buttonLabels = (container: Element) => [...container.querySelectorAll("button")].map((button) => button.textContent);

describe("CommentList replies", () => {
  it("opens the replies and keeps them open", async () => {
    const container = document.createElement("div");
    await act(async () => createRoot(container).render(<CommentList postId="post-1" />));
    expect(container.textContent).not.toContain("reply-list");

    const showReplies = [...container.querySelectorAll("button")].find((button) => button.textContent === "2 件の返信を見る");
    await act(async () => showReplies!.click());

    expect(container.textContent).toContain("reply-list");
    expect(buttonLabels(container)).toEqual(["返信する"]);
  });
});
