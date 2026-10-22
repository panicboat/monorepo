import { describe, expect, it } from "vitest";
import { buildDisplayWindow, displayStateOf } from "./display-window";

const now = new Date("2026-10-23T03:00:00.000Z");

describe("displayStateOf", () => {
  it("is live without a window", () => {
    expect(displayStateOf({ publishedAt: "2026-10-23T02:00:00Z", expiresAt: "" }, now)).toBe("live");
  });

  it("is scheduled before the start", () => {
    expect(displayStateOf({ publishedAt: "2026-10-23T04:00:00Z", expiresAt: "" }, now)).toBe("scheduled");
  });

  it("is expired once the end has passed", () => {
    expect(displayStateOf({ publishedAt: "2026-10-23T01:00:00Z", expiresAt: "2026-10-23T02:00:00Z" }, now)).toBe("expired");
  });

  it("is live when a post has no times", () => {
    expect(displayStateOf({ publishedAt: "", expiresAt: "" }, now)).toBe("live");
  });
});

describe("buildDisplayWindow", () => {
  it("carries no times when the window is off, even if inputs were filled", () => {
    expect(buildDisplayWindow({ enabled: false, start: "2026-10-25T09:00", end: "2026-10-26T09:00" })).toEqual({});
  });

  it("sends the filled times as ISO 8601 instants", () => {
    const window = buildDisplayWindow({ enabled: true, start: "2026-10-25T09:00", end: "2026-10-26T09:30" });

    expect(window).toEqual({
      publishedAt: "2026-10-25T00:00:00.000Z",
      expiresAt: "2026-10-26T00:30:00.000Z",
    });
    expect(window.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("leaves an empty start and end out", () => {
    expect(buildDisplayWindow({ enabled: true, start: "", end: "2026-10-26T09:30" })).toEqual({
      expiresAt: "2026-10-26T00:30:00.000Z",
    });
    expect(buildDisplayWindow({ enabled: true, start: "", end: "" })).toEqual({});
  });

  it("reads the inputs as Japan time", () => {
    expect(buildDisplayWindow({ enabled: true, start: "2026-10-25T09:05", end: "" })).toEqual({
      publishedAt: "2026-10-25T00:05:00.000Z",
    });
  });

  it("rejects a value that is not a date", () => {
    expect(() => buildDisplayWindow({ enabled: true, start: "not-a-date", end: "" })).toThrow("日時の形式が正しくありません");
    expect(() => buildDisplayWindow({ enabled: true, start: "", end: "2026-13-45T99:99" })).toThrow("日時の形式が正しくありません");
  });
});
