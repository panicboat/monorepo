import { describe, expect, it } from "vitest";

import { parseClientMessage, serializeServerMessage } from "./protocol.js";

describe("parseClientMessage", () => {
  it("accepts a complete consented join message", () => {
    expect(
      parseClientMessage({
        type: "join",
        roomId: "room_123",
        token: "token_123",
        displayName: "Ken",
        speechLanguage: "ja-JP",
        displayLanguage: "ja",
        consent: true,
      }),
    ).toEqual({ ok: true, value: expect.objectContaining({ type: "join" }) });
  });

  it("rejects joins without explicit consent", () => {
    expect(parseClientMessage({ type: "join", consent: false })).toEqual({
      ok: false,
      code: "invalid_message",
    });
  });

  it("rejects unknown keys in otherwise valid messages", () => {
    expect(
      parseClientMessage({
        type: "audio:start",
        unexpected: true,
      }),
    ).toEqual({ ok: false, code: "invalid_message" });
  });

  it("rejects unsupported languages", () => {
    expect(
      parseClientMessage({
        type: "join",
        roomId: "room_123",
        token: "token_123",
        displayName: "Ken",
        speechLanguage: "fr-FR",
        displayLanguage: "ja",
        consent: true,
      }),
    ).toEqual({ ok: false, code: "invalid_message" });
  });

  it("rejects display names longer than forty characters", () => {
    expect(
      parseClientMessage({
        type: "join",
        roomId: "room_123",
        token: "token_123",
        displayName: "a".repeat(41),
        speechLanguage: "ja-JP",
        displayLanguage: "ja",
        consent: true,
      }),
    ).toEqual({ ok: false, code: "invalid_message" });
  });

  it("rejects manual captions longer than two thousand characters", () => {
    expect(
      parseClientMessage({ type: "caption:manual", text: "a".repeat(2_001) }),
    ).toEqual({ ok: false, code: "invalid_message" });
  });

  it("accepts each non-join client message with only its declared fields", () => {
    expect(parseClientMessage({ type: "audio:start" })).toEqual({
      ok: true,
      value: { type: "audio:start" },
    });
    expect(parseClientMessage({ type: "audio:stop" })).toEqual({
      ok: true,
      value: { type: "audio:stop" },
    });
    expect(parseClientMessage({ type: "caption:manual", text: "Please repeat that." })).toEqual({
      ok: true,
      value: { type: "caption:manual", text: "Please repeat that." },
    });
    expect(parseClientMessage({ type: "clarification:request", captionId: "caption_123" })).toEqual({
      ok: true,
      value: { type: "clarification:request", captionId: "caption_123" },
    });
    expect(parseClientMessage({ type: "leave" })).toEqual({
      ok: true,
      value: { type: "leave" },
    });
  });
});

describe("serializeServerMessage", () => {
  it("serializes status codes without altering them", () => {
    expect(
      serializeServerMessage({ type: "status", code: "recognition_unavailable" }),
    ).toBe('{"type":"status","code":"recognition_unavailable"}');
  });
});
