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

const comment: CommentView = {
  id: "comment-1",
  postId: "post-1",
  parentId: null,
  authorProfileId: "author-1",
  content: "Nice post!",
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

const commentsMocks = vi.hoisted(() => ({
  useComments: vi.fn(),
}));

vi.mock("@/modules/post/hooks/useComments", () => ({
  useComments: commentsMocks.useComments,
}));

vi.mock("@/modules/post/hooks/useDeleteComment", () => ({
  useDeleteComment: () => ({ deleteComment: vi.fn(), submitting: false }),
}));

const { CommentList } = await import("./CommentList");

describe("CommentList", () => {
  it("links the comment author's avatar and name to their profile when a username is present", () => {
    commentsMocks.useComments.mockReturnValue({
      comments: [comment],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<CommentList postId="post-1" />);

    expect(html).toMatch(/<a[^>]*href="\/u\/coco_u"/);
  });

  it("does not link the comment author when there is no username", () => {
    commentsMocks.useComments.mockReturnValue({
      comments: [{ ...comment, author: { ...comment.author!, username: "" } }],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<CommentList postId="post-1" />);

    expect(html).not.toContain('<a href="/u/');
  });

  it("renders a mention in comment content as an inline link", () => {
    commentsMocks.useComments.mockReturnValue({
      comments: [
        {
          ...comment,
          content: "hi @alice",
          mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
        },
      ],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<CommentList postId="post-1" />);

    expect(html).toContain("@alice");
    expect(html).toContain('role="link"');
  });

  it("renders the delete control for a comment authored by the active profile", () => {
    authMocks.activeProfileId = "author-1";
    commentsMocks.useComments.mockReturnValue({
      comments: [comment],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<CommentList postId="post-1" />);

    expect(html).toContain(">削除</button>");
  });

  it("does not render the delete control for another active profile", () => {
    authMocks.activeProfileId = "viewer-1";
    commentsMocks.useComments.mockReturnValue({
      comments: [comment],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<CommentList postId="post-1" />);

    expect(html).not.toContain(">削除</button>");
  });

  it("does not render the delete control when no profile is active", () => {
    authMocks.activeProfileId = null;
    commentsMocks.useComments.mockReturnValue({
      comments: [comment],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const html = renderToStaticMarkup(<CommentList postId="post-1" />);

    expect(html).not.toContain(">削除</button>");
  });
});
