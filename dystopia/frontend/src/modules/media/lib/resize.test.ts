import { describe, expect, it } from "vitest";
import { fitWithin, isResizableImage } from "./resize";

describe("fitWithin", () => {
  it("shrinks the long edge to the limit and keeps the aspect ratio", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 640)).toEqual({ width: 480, height: 640 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});

describe("isResizableImage", () => {
  it.each([
    ["image/jpeg", true],
    ["image/png", true],
    ["image/heic", true],
    ["image/webp", true],
    ["image/gif", false],
    ["image/svg+xml", false],
    ["video/mp4", false],
  ])("treats %s as resizable: %s", (type, expected) => {
    expect(isResizableImage(type)).toBe(expected);
  });
});
