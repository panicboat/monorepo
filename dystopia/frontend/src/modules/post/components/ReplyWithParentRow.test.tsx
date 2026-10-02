import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReplyWithParentRow } from "./ReplyWithParentRow";
import type { CommentView } from "@/modules/post/lib/comment-view";
import type { PostView } from "@/modules/post/lib/post-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

const baseComment: CommentView = {
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

const parentPost: PostView = {
  id: "parent-post-1",
  authorId: "parent-author-1",
  content: "Parent post",
  media: [],
  createdAt: new Date().toISOString(),
  author: {
    accountId: "parent-author-1",
    displayName: "Parent",
    username: "parent",
    avatarUrl: "",
  },
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
};

describe("ReplyWithParentRow", () => {
  it("links the reply author's avatar and name to their profile when a username is present", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={null} />
    );

    expect(html).toMatch(/<a[^>]*href="\/u\/coco_u"/);
  });

  it("does not link the reply author when there is no username", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow
        comment={{ ...baseComment, author: { ...baseComment.author!, username: "" } }}
        parentPost={null}
      />
    );

    expect(html).not.toContain('<a href="/u/');
  });

  it("preserves the parent post preview layout classes", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={parentPost} />
    );

    expect(html).toContain('class="mt-1 line-clamp-2 text-sm text-text-primary"');
  });

  it("preserves the comment body whitespace layout class", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={null} />
    );

    expect(html).toContain('class="mt-1 whitespace-pre-wrap text-text-primary"');
  });
});
