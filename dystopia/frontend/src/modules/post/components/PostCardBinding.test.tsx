// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCardBinding } from "./PostCardBinding";
import type { PostView } from "@/modules/post/lib/post-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// next/image rewrites `src` to `/_next/image?url=<encoded>&w=...`, so match on the encoded original url.
function findImageWithUrl(url: string) {
  return document.querySelector(`img[src*="${encodeURIComponent(url)}"]`);
}

const basePost: PostView = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "こんにちは",
  media: [],
  createdAt: new Date().toISOString(),
  author: {
    profileId: "author-1",
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

  it("marks a post whose visibility is private", () => {
    const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, visibility: "private" }} />);

    expect(html.match(/aria-label="非公開"/g)).toHaveLength(1);
  });

  it("fills the heart only on a post the viewer has liked", () => {
    const liked = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, liked: true }} />);
    const notLiked = renderToStaticMarkup(<PostCardBinding post={basePost} />);

    expect(liked).toMatch(/lucide-heart[^"]*fill-current/);
    expect(notLiked).toContain("lucide-heart");
    expect(notLiked).not.toMatch(/lucide-heart[^"]*fill-current/);
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
          mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
        }}
      />
    );

    expect(html).toContain("@alice");
    expect(html).toContain('role="link"');
    expect(html).not.toMatch(/<a[^>]*><a/);
  });

  it("plays a video attached to the post", () => {
    const post: PostView = {
      ...basePost,
      media: [{ id: "media-1", mediaType: "video", url: "https://example.com/clip.mp4", thumbnailUrl: "", mediaId: "media-1" }],
    };

    const html = renderToStaticMarkup(<PostCardBinding post={post} />);

    expect(html).toMatch(/<video[^>]*src="https:\/\/example.com\/clip.mp4"/);
  });

  it("shows a video and an image attached to the same post", () => {
    const post: PostView = {
      ...basePost,
      media: [
        { id: "media-1", mediaType: "video", url: "https://example.com/clip.mp4", thumbnailUrl: "", mediaId: "media-1" },
        { id: "media-2", mediaType: "image", url: "https://example.com/photo.jpg", thumbnailUrl: "", mediaId: "media-2" },
      ],
    };

    const html = renderToStaticMarkup(<PostCardBinding post={post} />);

    expect(html.match(/<video/g)).toHaveLength(1);
    expect(html).toContain("画像を拡大");
  });

  it("shows the original-resolution image when a thumbnail is clicked", async () => {
    const post: PostView = {
      ...basePost,
      media: [
        {
          id: "media-1",
          mediaType: "image",
          url: "https://example.com/original-1.jpg",
          thumbnailUrl: "https://example.com/thumb-1.jpg",
          mediaId: "media-1",
        },
      ],
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<PostCardBinding post={post} />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(findImageWithUrl(post.media[0].url)).toBeNull();

    const thumbnailButton = container.querySelector("button[aria-label='画像を拡大']") as HTMLButtonElement;
    await act(async () => {
      thumbnailButton.click();
    });
    await act(async () => { await Promise.resolve(); });

    expect(findImageWithUrl(post.media[0].url)).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
