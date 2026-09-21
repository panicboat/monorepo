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

  it("renders a video element for a video attachment", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[video]} onRemove={() => {}} />
    );

    expect(html).toContain("<video");
    expect(html).toContain('src="blob:video-1"');
  });

  it("disables every remove button when disabled", () => {
    const html = renderToStaticMarkup(
      <PostComposerAttachments items={[image]} onRemove={() => {}} disabled />
    );

    expect(html).toContain('disabled=""');
  });
});
