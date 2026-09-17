import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCardBinding } from "./PostCardBinding";
import type { PostView } from "@/modules/post/lib/post-view";

const basePost: PostView = {
  id: "post-1",
  authorId: "author-1",
  content: "こんにちは",
  media: [],
  createdAt: new Date().toISOString(),
  author: {
    accountId: "author-1",
    displayName: "テスト太郎",
    username: "test_taro",
    avatarUrl: "",
  },
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  liked: false,
};

describe("PostCardBinding", () => {
  it("links the author name to their profile when a username is present", () => {
    const html = renderToStaticMarkup(<PostCardBinding post={basePost} />);

    expect(html).toContain(`<a href="/u/test_taro"`);
  });

  it("does not link the author name when there is no author", () => {
    const html = renderToStaticMarkup(
      <PostCardBinding post={{ ...basePost, author: null }} />
    );

    expect(html).not.toContain('<a href="/u/');
  });
});
