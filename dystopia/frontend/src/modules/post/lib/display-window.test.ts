import { describe, expect, it } from "vitest";
import { buildDisplayWindow, displayStateOf, toDateTimeLocal } from "./display-window";

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

describe("toDateTimeLocal", () => {
  it("formats an instant as a local datetime-local value", () => {
    const local = new Date(2026, 9, 25, 9, 5);

    expect(toDateTimeLocal(local.toISOString())).toBe("2026-10-25T09:05");
  });

  it("is empty for an empty value", () => {
    expect(toDateTimeLocal("")).toBe("");
  });
});

describe("buildDisplayWindow for a new post", () => {
  it("carries no times when the window is off, even if inputs were filled", () => {
    expect(buildDisplayWindow({ enabled: false, start: "2026-10-25T09:00", end: "2026-10-26T09:00" }, undefined, now)).toEqual({});
  });

  it("sends the filled times as ISO 8601 instants", () => {
    const window = buildDisplayWindow({ enabled: true, start: "2026-10-25T09:00", end: "2026-10-26T09:30" }, undefined, now);

    expect(window).toEqual({
      publishedAt: new Date(2026, 9, 25, 9, 0).toISOString(),
      expiresAt: new Date(2026, 9, 26, 9, 30).toISOString(),
    });
    expect(window.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("leaves an empty start and end out", () => {
    expect(buildDisplayWindow({ enabled: true, start: "", end: "2026-10-26T09:30" }, undefined, now)).toEqual({
      expiresAt: new Date(2026, 9, 26, 9, 30).toISOString(),
    });
    expect(buildDisplayWindow({ enabled: true, start: "", end: "" }, undefined, now)).toEqual({});
  });
});

describe("buildDisplayWindow for an edit", () => {
  const liveStart = "2026-10-23T01:00:30Z";
  const scheduledStart = "2026-10-25T00:00:30Z";

  it("never sends a start for a live post", () => {
    const original = { publishedAt: liveStart, expiresAt: "2026-10-30T00:00:45Z" };
    const form = { enabled: true, start: toDateTimeLocal(liveStart), end: toDateTimeLocal(original.expiresAt) };

    expect(buildDisplayWindow(form, original, now).publishedAt).toBeUndefined();
  });

  it("sends the stored end back untouched so its seconds survive", () => {
    const original = { publishedAt: liveStart, expiresAt: "2026-10-22T00:00:45Z" };
    const form = { enabled: true, start: toDateTimeLocal(liveStart), end: toDateTimeLocal(original.expiresAt) };

    expect(buildDisplayWindow(form, original, now).expiresAt).toBe("2026-10-22T00:00:45Z");
  });

  it("sends a changed end as a new instant", () => {
    const original = { publishedAt: liveStart, expiresAt: "2026-10-30T00:00:45Z" };
    const form = { enabled: true, start: toDateTimeLocal(liveStart), end: "2026-11-01T10:00" };

    expect(buildDisplayWindow(form, original, now).expiresAt).toBe(new Date(2026, 10, 1, 10, 0).toISOString());
  });

  it("sends no end once the user removed it", () => {
    const original = { publishedAt: liveStart, expiresAt: "2026-10-30T00:00:45Z" };
    const form = { enabled: true, start: toDateTimeLocal(liveStart), end: "" };

    expect(buildDisplayWindow(form, original, now).expiresAt).toBeUndefined();
  });

  it("sends the stored start back for a scheduled post the user did not touch", () => {
    const original = { publishedAt: scheduledStart, expiresAt: "" };
    const form = { enabled: true, start: toDateTimeLocal(scheduledStart), end: "" };

    expect(buildDisplayWindow(form, original, now).publishedAt).toBe(scheduledStart);
  });

  it("sends a changed start for a scheduled post", () => {
    const original = { publishedAt: scheduledStart, expiresAt: "" };
    const form = { enabled: true, start: "2026-10-27T08:00", end: "" };

    expect(buildDisplayWindow(form, original, now).publishedAt).toBe(new Date(2026, 9, 27, 8, 0).toISOString());
  });

  it("sends no start for a scheduled post whose start was cleared, so it goes live now", () => {
    const original = { publishedAt: scheduledStart, expiresAt: "" };

    expect(buildDisplayWindow({ enabled: true, start: "", end: "" }, original, now).publishedAt).toBeUndefined();
  });

  it("carries no times when the window is switched off", () => {
    const original = { publishedAt: scheduledStart, expiresAt: "2026-10-30T00:00:45Z" };
    const form = { enabled: false, start: toDateTimeLocal(scheduledStart), end: toDateTimeLocal(original.expiresAt) };

    expect(buildDisplayWindow(form, original, now)).toEqual({});
  });
});
