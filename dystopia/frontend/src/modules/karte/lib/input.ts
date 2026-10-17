import type { KarteEventInput, KarteStage } from "../types";

const STAGES: readonly string[] = ["reservation", "service", "aftercare"];

export function parseKarteEventInput(value: unknown): KarteEventInput | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.stage !== "string" || !STAGES.includes(input.stage)) return null;
  if (typeof input.outcome !== "string" || typeof input.occurredOn !== "string") return null;
  if (!Array.isArray(input.tags) || !input.tags.every((tag) => typeof tag === "string")) return null;
  return {
    stage: input.stage as KarteStage,
    outcome: input.outcome,
    tags: input.tags as string[],
    note: typeof input.note === "string" ? input.note : "",
    occurredOn: input.occurredOn,
  };
}

// Pass any integer through so the server, which owns the 1..5 rule, reports the error; anything else means unrated.
export function parseRating(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}
