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

export function buildDisplayWindow(form: DisplayWindowForm): DisplayWindowPayload {
  if (!form.enabled) return {};

  return {
    ...(form.start !== "" && { publishedAt: new Date(form.start).toISOString() }),
    ...(form.end !== "" && { expiresAt: new Date(form.end).toISOString() }),
  };
}
