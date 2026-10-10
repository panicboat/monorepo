import { describe, expect, it } from "vitest";
import { formatBodyStats, formatHeight } from "./format";

describe("formatBodyStats", () => {
  it("formats the three sizes as B/W/H with the cup and without the height", () => {
    expect(formatBodyStats({ heightCm: 168, bust: 88, waist: 55, hip: 86, cup: "E" })).toBe("B88(E) W55 H86");
  });

  it("omits the cup parenthesis when cup is unset", () => {
    expect(formatBodyStats({ heightCm: 0, bust: 88, waist: 0, hip: 0, cup: "" })).toBe("B88");
  });

  it("returns an empty string when only the height is set", () => {
    expect(formatBodyStats({ heightCm: 168, bust: 0, waist: 0, hip: 0, cup: "" })).toBe("");
  });

  it("returns an empty string when nothing is set", () => {
    expect(formatBodyStats({ heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" })).toBe("");
  });
});

describe("formatHeight", () => {
  it("formats the height in centimeters", () => {
    expect(formatHeight({ heightCm: 168, bust: 88, waist: 55, hip: 86, cup: "E" })).toBe("168cm");
  });

  it("returns an empty string when the height is unset", () => {
    expect(formatHeight({ heightCm: 0, bust: 88, waist: 55, hip: 86, cup: "E" })).toBe("");
  });
});
