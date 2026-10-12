import { eventCatalog, karteStages } from "./event-catalog";
import type { KarteStage } from "../types";

export function validateEvent(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { event: "出来事の入力が正しくありません" };
  const value = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const stage = typeof value.stage === "string" && karteStages.includes(value.stage as KarteStage) ? value.stage as KarteStage : null;
  if (!stage) errors.stage = "段階を選択してください";
  const catalog = stage ? eventCatalog[stage] : null;
  if (!catalog || typeof value.outcome !== "string" || !Object.hasOwn(catalog.outcomes, value.outcome)) errors.outcome = "対応結果を選択してください";
  const tags = value.tags === undefined ? [] : value.tags;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || !catalog || !Object.hasOwn(catalog.tags, tag)) || new Set(tags).size !== tags.length) errors.tags = "この段階の詳細タグを選択してください";
  const note = value.note === undefined ? "" : value.note;
  if (typeof note !== "string") errors.note = "補足の入力が正しくありません";
  else {
    if (Array.from(note).length > 500) errors.note = "補足は500文字以内で入力してください";
    const required = catalog && (catalog.noteOutcomes.includes(String(value.outcome)) || (Array.isArray(tags) && tags.some((tag) => catalog.noteTags.includes(tag))));
    if (required && !hasText(note)) errors.note = "この対応結果・タグには補足が必要です";
  }
  const day = value.occurredOn;
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number(day.slice(0, 4)) < 1) errors.occurredOn = "実在する発生日を入力してください";
  else {
    const date = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) errors.occurredOn = "実在する発生日を入力してください";
  }
  return errors;
}

export function validateKarte(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { entry: "カルテの入力が正しくありません" };
  const value = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const ratingError = validateRating(value.rating);
  if (ratingError) errors.rating = ratingError;
  const body = value.body === undefined || value.body === null ? "" : value.body;
  if (typeof body !== "string" || Array.from(body).length > 500) errors.body = "メモは500文字以内で入力してください";
  const events = value.events === undefined ? [] : value.events;
  if (!Array.isArray(events)) errors.events = "出来事の入力が正しくありません";
  else {
    events.forEach((event, index) => {
      for (const [key, error] of Object.entries(validateEvent(event))) errors[`events.${index}.${key}`] = error;
    });
    if (value.rating === 1 && !(typeof body === "string" && hasText(body)) && !events.some((event) => event && typeof event.note === "string" && hasText(event.note))) errors.note = "星1の評価には出来事か過去のメモに補足が必要です";
  }
  return errors;
}

export function validateRating(rating: unknown): string | null {
  return rating !== null && rating !== undefined && (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) ? "評価は未評価または1〜5で選択してください" : null;
}

function hasText(text: string): boolean {
  return /[^\p{White_Space}\uFEFF]/u.test(text);
}

export function japanToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
