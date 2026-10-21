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

export function toDateTimeLocal(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// A stored time that the input still shows unchanged is sent back as stored: the input drops the seconds, and the server compares to the second.
function resolveTime(input: string, stored: string | undefined): string | undefined {
  if (input === "") return undefined;
  if (stored && input === toDateTimeLocal(stored)) return stored;
  return new Date(input).toISOString();
}

export function buildDisplayWindow(
  form: DisplayWindowForm,
  original: DisplayWindow | undefined,
  now: Date = new Date()
): DisplayWindowPayload {
  if (!form.enabled) return {};

  const startLocked = !!original && displayStateOf(original, now) !== "scheduled";
  const publishedAt = startLocked ? undefined : resolveTime(form.start, original?.publishedAt);
  const expiresAt = resolveTime(form.end, original?.expiresAt);

  return {
    ...(publishedAt !== undefined && { publishedAt }),
    ...(expiresAt !== undefined && { expiresAt }),
  };
}
