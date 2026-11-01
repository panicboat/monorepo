// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCard } from "./post-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps = {
  author: { name: "テスト太郎", handle: "test_taro" },
  time: "1分前",
  body: "こんにちは",
};

const oneImage = [{ thumbnailUrl: "https://example.com/thumb-1.jpg", url: "https://example.com/full-1.jpg" }];
const twoImages = [
  { thumbnailUrl: "https://example.com/thumb-1.jpg", url: "https://example.com/full-1.jpg" },
  { thumbnailUrl: "https://example.com/thumb-2.jpg", url: "https://example.com/full-2.jpg" },
];

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

// next/image rewrites `src` to `/_next/image?url=<encoded>&w=...`, so match on the encoded original url.
function findImageWithUrl(url: string) {
  return document.querySelector(`img[src*="${encodeURIComponent(url)}"]`);
}

async function renderMounted(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  await flush();
  return {
    container,
    teardown: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("PostCard", () => {
  it("marks a followers-only post next to its time", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} isPrivate />);

    expect(html).toMatch(/· 1分前<\/span><span role="img" aria-label="フォロワーのみ"/);
    expect(html).not.toContain('aria-label="非公開"');
  });

  it("shows the status mark next to the time", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} statusMark="表示終了" />);

    expect(html).toMatch(/· 1分前<\/span><span[^>]*>表示終了<\/span>/);
  });

  it("shows no status mark by default", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} />);

    expect(html).not.toContain("表示終了");
    expect(html).not.toContain("予約");
  });

  it("leaves a public post unmarked", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} />);

    expect(html).not.toContain('aria-label="フォロワーのみ"');
  });

  it("marks a private author with the lock mark", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} author={{ ...baseProps.author, isPrivate: true }} />);

    expect(html).toContain('aria-label="鍵付き"');
  });

  it("plays each given video inline with controls, loading only its metadata up front", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} videos={[{ url: "https://example.com/a.mp4" }, { url: "https://example.com/b.mp4" }]} />
    );

    expect(html.match(/<video/g)).toHaveLength(2);
    expect(html).toMatch(/<video[^>]*src="https:\/\/example.com\/a.mp4"[^>]*controls=""[^>]*playsInline=""[^>]*preload="metadata"/);
  });

  it("does not nest a video inside the post detail link", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} detailHref="/posts/post-1" videos={[{ url: "https://example.com/a.mp4" }]} />
    );
    const detailLink = html.match(/<a[^>]*href="\/posts\/post-1"[^>]*>.*?<\/a>/)?.[0] ?? "";

    expect(detailLink).not.toBe("");
    expect(detailLink).not.toContain("<video");
  });

  it("wraps the reactions onto another row instead of overflowing a narrow screen", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} reactions={<button type="button">いいね</button>} />);

    expect(html).toMatch(/<div class="[^"]*\bflex-wrap\b[^"]*"><button[^>]*>いいね<\/button><\/div>/);
  });

  it("renders no video element for a post without videos", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} images={oneImage} />);

    expect(html).not.toContain("<video");
  });

  it("wraps the author name in a link to the profile when authorHref is given", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} authorHref="/u/test_taro" />
    );

    expect(html).toContain(`<a href="/u/test_taro"`);
    expect(html).toContain("テスト太郎");
  });

  it("renders the author name as plain text when authorHref is not given", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} />);

    expect(html).not.toContain("<a ");
  });

  it("wraps the body in a link to the post when detailHref is given", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} detailHref="/posts/post-1" />
    );

    expect(html).toContain(`href="/posts/post-1"`);
    expect(html).toContain("こんにちは");
  });

  it("does not link the body when detailHref is not given", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} />);

    expect(html).not.toContain("<a ");
  });

  it("renders the attachment under the body, outside the detail link", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} detailHref="/posts/post-1" attachment={<a href="/u/rin">予定</a>} />
    );

    expect(html.indexOf("予定")).toBeGreaterThan(html.indexOf("こんにちは"));
    expect(html).toMatch(/<\/a><a href="\/u\/rin">予定<\/a>/);
  });

  it("renders no body paragraph when the body is omitted", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} body={undefined} detailHref="/posts/post-1" attachment={<div>予定</div>} />
    );

    expect(html).not.toMatch(/<p[^>]*><\/p>/);
    expect(html).not.toContain(`href="/posts/post-1"`);
    expect(html).toContain("予定");
  });

  it("does not nest the image thumbnail inside the post detail link", async () => {
    const { container, teardown } = await renderMounted(
      <PostCard {...baseProps} detailHref="/posts/post-1" images={oneImage} />
    );

    const thumbnailButton = container.querySelector("button[aria-label='画像を拡大']");
    expect(thumbnailButton?.closest("a")).toBeNull();

    await teardown();
  });

  it("opens a lightbox showing the full-resolution image when a thumbnail is clicked", async () => {
    const { container, teardown } = await renderMounted(
      <PostCard {...baseProps} images={oneImage} />
    );

    const thumbnailButton = container.querySelector("button[aria-label='画像を拡大']") as HTMLButtonElement;
    await act(async () => {
      thumbnailButton.click();
    });
    await flush();

    const dialogImage = findImageWithUrl(oneImage[0].url);
    expect(dialogImage).not.toBeNull();

    await teardown();
  });

  it("closes the lightbox when the close button is clicked", async () => {
    const { container, teardown } = await renderMounted(
      <PostCard {...baseProps} images={oneImage} />
    );

    const thumbnailButton = container.querySelector("button[aria-label='画像を拡大']") as HTMLButtonElement;
    await act(async () => {
      thumbnailButton.click();
    });
    await flush();

    const closeButton = document.querySelector("button[aria-label='閉じる']") as HTMLButtonElement;
    await act(async () => {
      closeButton.click();
    });
    await flush();

    expect(findImageWithUrl(oneImage[0].url)).toBeNull();

    await teardown();
  });

  it("cycles to the next image when the next control is clicked", async () => {
    const { container, teardown } = await renderMounted(
      <PostCard {...baseProps} images={twoImages} />
    );

    const thumbnailButtons = container.querySelectorAll("button[aria-label='画像を拡大']");
    await act(async () => {
      (thumbnailButtons[0] as HTMLButtonElement).click();
    });
    await flush();

    const nextButton = document.querySelector("button[aria-label='次の画像']") as HTMLButtonElement;
    await act(async () => {
      nextButton.click();
    });
    await flush();

    expect(findImageWithUrl(twoImages[1].url)).not.toBeNull();

    await teardown();
  });

  it("does not render prev/next controls when there is only one image", async () => {
    const { container, teardown } = await renderMounted(
      <PostCard {...baseProps} images={oneImage} />
    );

    const thumbnailButton = container.querySelector("button[aria-label='画像を拡大']") as HTMLButtonElement;
    await act(async () => {
      thumbnailButton.click();
    });
    await flush();

    expect(document.querySelector("button[aria-label='次の画像']")).toBeNull();
    expect(document.querySelector("button[aria-label='前の画像']")).toBeNull();

    await teardown();
  });
});
