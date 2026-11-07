// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MediaGallery } from "./media-gallery";

const image = (n: number) => ({
  thumbnailUrl: `https://example.com/thumb-${n}.jpg`,
  url: `https://example.com/full-${n}.jpg`,
});

describe("MediaGallery", () => {
  it("renders a button to enlarge each image", () => {
    const html = renderToStaticMarkup(<MediaGallery images={[image(1), image(2)]} />);

    expect(html.match(/aria-label="画像を拡大"/g)).toHaveLength(2);
  });

  it("shows at most four images", () => {
    const html = renderToStaticMarkup(<MediaGallery images={[image(1), image(2), image(3), image(4), image(5)]} />);

    expect(html.match(/aria-label="画像を拡大"/g)).toHaveLength(4);
  });

  it("plays each given video inline with controls, loading only its metadata up front", () => {
    const html = renderToStaticMarkup(
      <MediaGallery videos={[{ url: "https://example.com/a.mp4" }, { url: "https://example.com/b.mp4" }]} />
    );

    expect(html.match(/<video/g)).toHaveLength(2);
    expect(html).toMatch(/<video[^>]*src="https:\/\/example.com\/a.mp4"[^>]*controls=""[^>]*playsInline=""[^>]*preload="metadata"/);
  });

  it("renders nothing without images or videos", () => {
    expect(renderToStaticMarkup(<MediaGallery />)).toBe("");
    expect(renderToStaticMarkup(<MediaGallery images={[]} videos={[]} />)).toBe("");
  });
});
