import { describe, expect, it } from "vitest";
import type { Review, ReviewEvent, ReviewMedia } from "../types";
import { galleryOf, latestEventMedia } from "./media";

function image(id: string, thumbnailUrl = `https://cdn/${id}-t.jpg`): ReviewMedia {
  return { mediaId: id, mediaType: "image", url: `https://cdn/${id}.jpg`, thumbnailUrl };
}

function event(id: string, media: ReviewMedia[]): ReviewEvent {
  return { id, stage: "service", outcome: "satisfied", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", media };
}

function review(events: ReviewEvent[]): Review {
  return {
    id: "r-1",
    authorProfileId: "author",
    author: null,
    authorHidden: false,
    targetProfileId: "target",
    target: null,
    isMine: true,
    rating: null,
    events,
    createdAt: "",
    updatedAt: "",
    lastActivityAt: "",
  };
}

describe("latestEventMedia", () => {
  it("returns the media of the last event that has any, even when later events have none", () => {
    const events = [event("e-1", [image("m-1")]), event("e-2", [image("m-2"), image("m-3")]), event("e-3", [])];

    expect(latestEventMedia(review(events)).map((m) => m.mediaId)).toEqual(["m-2", "m-3"]);
  });

  it("returns an empty list when no event has media", () => {
    expect(latestEventMedia(review([event("e-1", []), event("e-2", [])]))).toEqual([]);
    expect(latestEventMedia(review([]))).toEqual([]);
  });
});

describe("galleryOf", () => {
  it("separates images from videos", () => {
    const video: ReviewMedia = { mediaId: "m-2", mediaType: "video", url: "https://cdn/m-2.mp4", thumbnailUrl: "" };

    expect(galleryOf([image("m-1"), video])).toEqual({
      images: [{ url: "https://cdn/m-1.jpg", thumbnailUrl: "https://cdn/m-1-t.jpg" }],
      videos: [{ url: "https://cdn/m-2.mp4" }],
    });
  });

  it("uses the url as the thumbnail of an image without one", () => {
    expect(galleryOf([image("m-1", "")]).images).toEqual([{ url: "https://cdn/m-1.jpg", thumbnailUrl: "https://cdn/m-1.jpg" }]);
  });

  it("returns empty lists for no media", () => {
    expect(galleryOf([])).toEqual({ images: [], videos: [] });
  });
});
