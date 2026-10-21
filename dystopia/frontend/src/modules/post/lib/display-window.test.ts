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
      publishedAt: new Date(2026, 9, 25, 9, 0).toISOString(),
      expiresAt: new Date(2026, 9, 26, 9, 30).toISOString(),
    });
    expect(window.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("leaves an empty start and end out", () => {
    expect(buildDisplayWindow({ enabled: true, start: "", end: "2026-10-26T09:30" })).toEqual({
      expiresAt: new Date(2026, 9, 26, 9, 30).toISOString(),
    });
    expect(buildDisplayWindow({ enabled: true, start: "", end: "" })).toEqual({});
  });
});
