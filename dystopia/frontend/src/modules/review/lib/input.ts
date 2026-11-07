import type { ReviewEventInput, ReviewMedia, ReviewStage } from "../types";

const STAGES: readonly string[] = ["reservation", "service", "aftercare"];

function parseReviewMediaList(value: unknown): ReviewMedia[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const list: ReviewMedia[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { mediaId, mediaType } = item as Record<string, unknown>;
    if (typeof mediaId !== "string" || (mediaType !== "image" && mediaType !== "video")) return null;
    // The server resolves media by id, so the URLs a client sends are not carried.
    list.push({ mediaId, mediaType, url: "", thumbnailUrl: "" });
  }
  return list;
}

export function parseReviewEventInput(value: unknown): ReviewEventInput | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.stage !== "string" || !STAGES.includes(input.stage)) return null;
  if (typeof input.outcome !== "string" || typeof input.occurredOn !== "string") return null;
  if (!Array.isArray(input.tags) || !input.tags.every((tag) => typeof tag === "string")) return null;
  const media = parseReviewMediaList(input.media);
  if (media === null) return null;
  return {
    stage: input.stage as ReviewStage,
    outcome: input.outcome,
    tags: input.tags as string[],
    note: typeof input.note === "string" ? input.note : "",
    occurredOn: input.occurredOn,
    media,
  };
}

// Pass any integer through so the server, which owns the 1..5 rule, reports the error; anything else means unrated.
export function parseRating(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}
