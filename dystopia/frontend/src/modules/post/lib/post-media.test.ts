import { describe, expect, it } from "vitest";
import { toSavePostMedia } from "./post-media";
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

describe("toSavePostMedia", () => {
  it("maps uploaded media to save-post media inputs, preserving order", () => {
    expect(toSavePostMedia([image, video])).toEqual([
      { mediaType: "image", mediaId: "media-1" },
      { mediaType: "video", mediaId: "media-2" },
    ]);
  });

  it("returns an empty array when nothing is attached", () => {
    expect(toSavePostMedia([])).toEqual([]);
  });
});
