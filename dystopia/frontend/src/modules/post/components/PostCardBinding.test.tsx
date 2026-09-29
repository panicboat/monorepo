import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCardBinding } from "./PostCardBinding";
import type { PostView } from "@/modules/post/lib/post-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

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
  mentions: [],
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

  it("links the post body to the post detail page", () => {
    const html = renderToStaticMarkup(<PostCardBinding post={basePost} />);

    expect(html).toContain(`href="/posts/post-1"`);
  });

  it("links the post body to the given detailHref when provided", () => {
    const html = renderToStaticMarkup(
      <PostCardBinding post={basePost} detailHref="/discovery/posts/post-1" />
    );

    expect(html).toContain(`href="/discovery/posts/post-1"`);
  });

  it("renders a mention in the post content without nesting links", () => {
    const html = renderToStaticMarkup(
      <PostCardBinding
        post={{
          ...basePost,
          content: "hi @alice",
          mentions: [{ accountId: "acc-1", username: "alice", position: 3, length: 6 }],
        }}
      />
    );

    expect(html).toContain("@alice");
    expect(html).toContain('role="link"');
    expect(html).not.toMatch(/<a[^>]*><a/);
  });
});
