// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCardBinding } from "./PostCardBinding";
import type { PostView } from "@/modules/post/lib/post-view";
import { useAuthStore } from "@/stores/authStore";

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
  publishedAt: new Date().toISOString(),
  expiresAt: "",
  author: {
    profileId: "author-1",
    displayName: "テスト太郎",
    username: "test_taro",
    avatarUrl: "",
    isPrivate: false,
    role: null,
    industry: "",
  },
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
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

  it("falls back to the handle when the author has no display name", () => {
    const html = renderToStaticMarkup(
      <PostCardBinding post={{ ...basePost, author: { ...basePost.author!, displayName: "", username: "rin" } }} />
    );

    expect(html).toContain("@rin");
    expect(html).not.toContain("名無し");
  });

  it("uses a question mark as the avatar initial for a deleted author and the first character otherwise", () => {
    const initialOf = (html: string) => html.match(/rounded-full[^>]*>(?:<img[^>]*>)?<span[^>]*>([^<]*)<\/span>/)?.[1];

    expect(initialOf(renderToStaticMarkup(<PostCardBinding post={{ ...basePost, author: null }} />))).toBe("?");
    expect(initialOf(renderToStaticMarkup(<PostCardBinding post={basePost} />))).toBe("テ");
  });

  it("names a deleted author without a handle", () => {
    const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, author: null }} />);

    expect(html).toContain("（無効なユーザー）");
    expect(html).not.toContain("@author-1");
    expect(html).not.toContain("@</span>");
  });

  it("marks a post whose visibility is private as followers-only", () => {
    const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, visibility: "private" }} />);

    expect(html.match(/aria-label="フォロワーのみ"/g)).toHaveLength(1);
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

  describe("schedule card", () => {
    const schedule = { workDate: "2026-10-23", startTime: "20:00", endTime: "02:00" };
    const withIndustry = (industry: string) => ({ ...basePost.author!, industry });

    it("shows the heading and the time of the linked schedule, linked to the author's schedule tab", () => {
      const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, schedule }} />);

      expect(html).toContain("20:00〜02:00");
      expect(html).toContain("10/23（金）");
      expect(html).toMatch(/<a[^>]*href="\/u\/test_taro\?tab=schedule"[^>]*>(?:(?!<\/a>).)*予定(?:(?!<\/a>).)*20:00〜02:00/s);
    });

    it("shows no schedule card on a post without a schedule", () => {
      const html = renderToStaticMarkup(<PostCardBinding post={basePost} />);

      expect(html).not.toContain("予定");
    });

    it("leads the date with the industry icon of the author", () => {
      const html = renderToStaticMarkup(
        <PostCardBinding post={{ ...basePost, schedule, author: withIndustry("デリヘル") }} />
      );

      expect(html).toMatch(/<span role="img" aria-label="デリヘル"[^>]*>🚗<\/span>/);
      expect(html.indexOf("🚗")).toBeLessThan(html.indexOf("10/23（金）"));
    });

    it("shows no icon when the industry is empty or not in the list", () => {
      for (const industry of ["", "未知の業種"]) {
        const html = renderToStaticMarkup(
          <PostCardBinding post={{ ...basePost, schedule, author: withIndustry(industry) }} />
        );

        expect(html).not.toContain('role="img"');
      }
    });

    it("renders no link to the profile when the author has no username", () => {
      const html = renderToStaticMarkup(
        <PostCardBinding post={{ ...basePost, schedule, author: { ...withIndustry("デリヘル"), username: "" } }} />
      );

      expect(html).not.toContain('<a href="/u/');
      expect(html).toContain("20:00〜02:00");
      expect(html).toContain("10/23（金）");
    });

    it("keeps the note above the card", () => {
      const html = renderToStaticMarkup(
        <PostCardBinding post={{ ...basePost, content: "お待ちしてます！", schedule }} />
      );

      expect(html.indexOf("お待ちしてます！")).toBeLessThan(html.indexOf("予定"));
    });

    it("renders no empty paragraph for a note-less announcement", () => {
      const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, content: "", schedule }} />);

      expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/);
      expect(html).toContain("予定");
    });

    it("shows the card in the post detail as well", () => {
      const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, schedule }} inDetail />);

      expect(html).toContain("20:00〜02:00");
      expect(html).toContain("10/23（金）");
    });
  });

  describe("display window marks", () => {
    const hours = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
    const asViewer = (profileId: string | null) => useAuthStore.setState({ activeProfileId: profileId });

    afterEach(() => asViewer(null));

    // The store is read from its initial state when rendering to a string, so the viewer only shows up in a mounted tree.
    const renderMounted = async (post: PostView) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<PostCardBinding post={post} />);
      });
      const html = container.innerHTML;
      await act(async () => {
        root.unmount();
      });
      container.remove();
      return html;
    };

    it("marks the author's scheduled post with its start in Japan time", async () => {
      asViewer("author-1");
      const publishedAt = "2099-10-25T00:05:00.000Z";

      const html = await renderMounted({ ...basePost, publishedAt });

      expect(html).toContain("予約 10/25 09:05 から");
    });

    it("shows no elapsed time on the author's scheduled post", async () => {
      asViewer("author-1");

      const html = await renderMounted({ ...basePost, publishedAt: "2099-10-25T00:05:00.000Z" });

      expect(html).not.toContain("·");
      expect(html).not.toContain("now");
    });

    it("keeps the elapsed time on a live post", async () => {
      asViewer("author-1");

      const html = await renderMounted(basePost);

      expect(html).toContain("·");
    });

    it("marks the author's expired post", async () => {
      asViewer("author-1");

      const html = await renderMounted({ ...basePost, publishedAt: hours(-5), expiresAt: hours(-1) });

      expect(html).toContain("表示終了");
      expect(html).not.toContain("予約");
    });

    it("shows no mark on a live post, with or without an end", async () => {
      asViewer("author-1");

      const plain = await renderMounted(basePost);
      const withEnd = await renderMounted({ ...basePost, expiresAt: hours(5) });

      for (const html of [plain, withEnd]) {
        expect(html).not.toContain("予約");
        expect(html).not.toContain("表示終了");
      }
    });

    it("shows no mark to a viewer who is not the author", async () => {
      asViewer("someone-else");

      const scheduled = await renderMounted({ ...basePost, publishedAt: hours(5) });
      const expired = await renderMounted({ ...basePost, publishedAt: hours(-5), expiresAt: hours(-1) });

      for (const html of [scheduled, expired]) {
        expect(html).not.toContain("予約");
        expect(html).not.toContain("表示終了");
      }
    });

    it("dates the post by its display start rather than its creation", () => {
      const createdAt = new Date(Date.now() - 3 * 86400000).toISOString();

      const html = renderToStaticMarkup(
        <PostCardBinding post={{ ...basePost, createdAt, publishedAt: new Date().toISOString() }} />
      );

      expect(html).toMatch(/· (<!-- -->)?now</);
    });

    it("falls back to the creation time when there is no display start", () => {
      const createdAt = new Date(Date.now() - 3 * 86400000).toISOString();

      const html = renderToStaticMarkup(<PostCardBinding post={{ ...basePost, createdAt, publishedAt: "" }} />);

      expect(html).toMatch(/· (<!-- -->)?3d ago</);
    });
  });
});
