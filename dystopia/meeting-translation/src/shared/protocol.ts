import type { ClientMessage, DisplayLanguage, ServerMessage, SpeechLanguage } from "./meeting.js";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: "invalid_message" };

const invalidMessage = (): ParseResult<never> => ({ ok: false, code: "invalid_message" });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const valueKeys = Object.keys(value);
  return valueKeys.length === keys.length && valueKeys.every((key) => keys.includes(key));
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isSpeechLanguage = (value: unknown): value is SpeechLanguage =>
  value === "ja-JP" || value === "en-US";

const isDisplayLanguage = (value: unknown): value is DisplayLanguage => value === "ja" || value === "en";

export const parseClientMessage = (value: unknown): ParseResult<ClientMessage> => {
  if (!isRecord(value) || typeof value.type !== "string") return invalidMessage();

  switch (value.type) {
    case "join":
      if (
        !hasOnlyKeys(value, [
          "type",
          "roomId",
          "token",
          "displayName",
          "speechLanguage",
          "displayLanguage",
          "consent",
        ]) ||
        !isNonEmptyString(value.roomId) ||
        !isNonEmptyString(value.token) ||
        !isNonEmptyString(value.displayName) ||
        value.displayName.length > 40 ||
        !isSpeechLanguage(value.speechLanguage) ||
        !isDisplayLanguage(value.displayLanguage) ||
        value.consent !== true
      ) {
        return invalidMessage();
      }

      return {
        ok: true,
        value: {
          type: "join",
          roomId: value.roomId,
          token: value.token,
          displayName: value.displayName,
          speechLanguage: value.speechLanguage,
          displayLanguage: value.displayLanguage,
          consent: true,
        },
      };
    case "audio:start":
    case "audio:stop":
    case "leave":
      if (!hasOnlyKeys(value, ["type"])) return invalidMessage();
      return { ok: true, value: { type: value.type } };
    case "caption:manual":
      if (
        !hasOnlyKeys(value, ["type", "text"]) ||
        !isNonEmptyString(value.text) ||
        value.text.length > 2_000
      ) {
        return invalidMessage();
      }
      return { ok: true, value: { type: "caption:manual", text: value.text } };
    case "clarification:request":
      if (!hasOnlyKeys(value, ["type", "captionId"]) || !isNonEmptyString(value.captionId)) {
        return invalidMessage();
      }
      return { ok: true, value: { type: "clarification:request", captionId: value.captionId } };
    default:
      return invalidMessage();
  }
};

export const serializeServerMessage = (message: ServerMessage): string => JSON.stringify(message);
