import { describe, expect, it } from "vitest";
import { isPlainClick } from "./isPlainClick";

const click = (overrides: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({
  button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...overrides,
});

describe("isPlainClick", () => {
  it("accepts a left click without modifier keys", () => {
    expect(isPlainClick(click())).toBe(true);
  });

  it("refuses modifier keys and other buttons", () => {
    expect(isPlainClick(click({ metaKey: true }))).toBe(false);
    expect(isPlainClick(click({ ctrlKey: true }))).toBe(false);
    expect(isPlainClick(click({ shiftKey: true }))).toBe(false);
    expect(isPlainClick(click({ altKey: true }))).toBe(false);
    expect(isPlainClick(click({ button: 1 }))).toBe(false);
  });
});
