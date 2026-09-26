import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReplyWithParentRow } from "./ReplyWithParentRow";
import type { CommentView } from "@/modules/post/lib/comment-view";

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
};

describe("ReplyWithParentRow", () => {
  it("links the reply author's avatar and name to their profile when a username is present", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={null} />
    );

    expect(html).toContain(`<a href="/u/coco_u"`);
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
});
