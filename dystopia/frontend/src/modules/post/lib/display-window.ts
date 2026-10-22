export type DisplayState = "live" | "scheduled" | "expired";

export interface DisplayWindow {
  publishedAt: string;
  expiresAt: string;
}

export interface DisplayWindowForm {
  enabled: boolean;
  start: string;
  end: string;
}

export interface DisplayWindowPayload {
  publishedAt?: string;
  expiresAt?: string;
}

export function displayStateOf(window: DisplayWindow, now: Date = new Date()): DisplayState {
  if (window.publishedAt && new Date(window.publishedAt) > now) return "scheduled";
  if (window.expiresAt && new Date(window.expiresAt) <= now) return "expired";
  return "live";
}

function toInstant(localValue: string): string {
  const date = new Date(`${localValue}:00+09:00`);
  if (Number.isNaN(date.getTime())) throw new Error("日時の形式が正しくありません");
  return date.toISOString();
}

export function buildDisplayWindow(form: DisplayWindowForm): DisplayWindowPayload {
  if (!form.enabled) return {};

  return {
    ...(form.start !== "" && { publishedAt: toInstant(form.start) }),
    ...(form.end !== "" && { expiresAt: toInstant(form.end) }),
  };
}
