import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PostComposerAttachments } from "./PostComposerAttachments";
import type { UploadedMedia } from "@/modules/media/types";

const image: UploadedMedia = {
  mediaId: "media-1",
  mediaKey: "key-1",
  uploadUrl: "https://example.com/upload",
  localUrl: "blob:image-1",
  filename: "photo.jpg",
  contentType: "image/jpeg",
  sizeBytes: 1024,
  mediaType: "image",
};

const video: UploadedMedia = {
  ...image,
  mediaId: "media-2",
  localUrl: "blob:video-1",
  filename: "clip.mp4",
  contentType: "video/mp4",
  mediaType: "video",
};

describe("PostComposerAttachments", () => {
  it("renders nothing when there are no attachments", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[]} onRemove={() => {}} />
    );

    expect(html).toBe("");
  });

  it("renders a preview and a labeled remove button for an image attachment", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[image]} onRemove={() => {}} />
    );

    expect(html).toContain('src="blob:image-1"');
    expect(html).toContain('aria-label="photo.jpgを削除"');
  });

  it("renders the cut frame as an image for a video attachment that has a thumbnail", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[{ ...video, thumbnailLocalUrl: "blob:thumb-1" }]} onRemove={() => {}} />
    );

    expect(html).toContain('<img src="blob:thumb-1"');
    expect(html).not.toContain("<video");
  });

  it("asks a video attachment without a thumbnail for the frame at 0.1 seconds", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[video]} onRemove={() => {}} />
    );

    expect(html).toContain("<video");
    expect(html).toContain('src="blob:video-1#t=0.1"');
    expect(html).not.toContain("<img");
  });

  it("disables every remove button when disabled", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[image]} onRemove={() => {}} disabled />
    );

    expect(html).toContain('disabled=""');
  });
});
