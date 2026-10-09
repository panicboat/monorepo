import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommentView } from "@/modules/post/lib/comment-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

const authMocks = vi.hoisted(() => ({ activeProfileId: null as string | null }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector?: (state: { activeProfileId: string | null }) => unknown) => {
    const state = { activeProfileId: authMocks.activeProfileId };
    return selector ? selector(state) : state;
  },
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
}));

const reply: CommentView = {
  id: "reply-1",
  postId: "post-1",
  parentId: "comment-1",
  authorProfileId: "author-1",
  content: "Reply body",
  createdAt: new Date().toISOString(),
  author: {
    profileId: "author-1",
    name: "Coco",
    imageUrl: "",
    username: "coco_u",
  },
  repliesCount: 0,
  mentions: [],
};

const repliesMocks = vi.hoisted(() => ({
  useReplies: vi.fn(),
}));

vi.mock("@/modules/post/hooks/useReplies", () => ({
  useReplies: repliesMocks.useReplies,
}));

vi.mock("@/modules/post/hooks/useDeleteComment", () => ({
  useDeleteComment: () => ({ deleteComment: vi.fn(), submitting: false }),
}));

const { ReplyList } = await import("./ReplyList");

describe("ReplyList", () => {
  it("links the reply author's avatar and name to their profile when a username is present", () => {
    repliesMocks.useReplies.mockReturnValue({
      replies: [reply],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<ReplyList postId="post-1" commentId="comment-1" />);

    expect(html).toMatch(/<a[^>]*href="\/u\/coco_u"/);
  });

  it("does not link the reply author when there is no username", () => {
    repliesMocks.useReplies.mockReturnValue({
      replies: [{ ...reply, author: { ...reply.author!, username: "" } }],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<ReplyList postId="post-1" commentId="comment-1" />);

    expect(html).not.toContain('<a href="/u/');
  });

  it("renders the delete control for a reply authored by the active profile", () => {
    authMocks.activeProfileId = "author-1";
    repliesMocks.useReplies.mockReturnValue({
      replies: [reply],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<ReplyList postId="post-1" commentId="comment-1" />);

    expect(html).toContain(">削除</button>");
  });

  it("does not render the delete control for another active profile", () => {
    authMocks.activeProfileId = "viewer-1";
    repliesMocks.useReplies.mockReturnValue({
      replies: [reply],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<ReplyList postId="post-1" commentId="comment-1" />);

    expect(html).not.toContain(">削除</button>");
  });

  it("does not render the delete control when no profile is active", () => {
    authMocks.activeProfileId = null;
    repliesMocks.useReplies.mockReturnValue({
      replies: [reply],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<ReplyList postId="post-1" commentId="comment-1" />);

    expect(html).not.toContain(">削除</button>");
  });
});
