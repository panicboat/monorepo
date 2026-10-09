import { describe, expect, it } from "vitest";
import { mapCommentToView } from "./comment-mappers";
import type { Comment, CommentAuthor } from "@/stub/post/v1/comment_service_pb";

const author: CommentAuthor = {
  $typeName: "post.v1.CommentAuthor",
  profileId: "author-profile-1",
  name: "Coco",
  imageUrl: "https://example.com/a.png",
  userType: "guest",
  username: "coco_u",
};

const comment: Comment = {
  $typeName: "post.v1.Comment",
  id: "comment-1",
  postId: "post-1",
  parentId: "",
  authorProfileId: "comment-profile-1",
  content: "Nice post!",
  createdAt: new Date().toISOString(),
  author,
  media: [],
  repliesCount: 0,
  mentions: [],
};

describe("mapCommentToView", () => {
  it("maps the comment and author profile IDs independently", () => {
    const view = mapCommentToView(comment);

    expect(view.authorProfileId).toBe("comment-profile-1");
    expect(view.author?.profileId).toBe("author-profile-1");
  });

  it("carries the author's username through to the view", () => {
    const view = mapCommentToView(comment);

    expect(view.author?.username).toBe("coco_u");
  });

  it("returns a null author when the comment has no author", () => {
    const view = mapCommentToView({ ...comment, author: undefined });

    expect(view.author).toBeNull();
  });
});
