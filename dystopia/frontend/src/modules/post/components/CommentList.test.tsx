import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommentView } from "@/modules/post/lib/comment-view";

const comment: CommentView = {
  id: "comment-1",
  postId: "post-1",
  parentId: null,
  userId: "author-1",
  content: "Nice post!",
  createdAt: new Date().toISOString(),
  author: {
    userId: "author-1",
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

    expect(html).toContain(`<a href="/u/coco_u"`);
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
});
