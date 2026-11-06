import type { Review, ReviewMedia } from "../types";

export function latestEventMedia(review: Review): ReviewMedia[] {
  return [...review.events].reverse().find((event) => event.media.length > 0)?.media ?? [];
}

export function galleryOf(media: ReviewMedia[]): { images: { url: string; thumbnailUrl: string }[]; videos: { url: string }[] } {
  return {
    images: media.filter((m) => m.mediaType === "image").map((m) => ({ url: m.url, thumbnailUrl: m.thumbnailUrl || m.url })),
    videos: media.filter((m) => m.mediaType === "video").map((m) => ({ url: m.url })),
  };
}
