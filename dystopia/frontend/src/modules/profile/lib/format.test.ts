import { describe, expect, it } from "vitest";
import { formatBodyStats } from "./format";

describe("formatBodyStats", () => {
  it("formats full body stats as B/W/H with cup and height", () => {
    expect(formatBodyStats({ heightCm: 168, bust: 88, waist: 55, hip: 86, cup: "E" })).toBe(
      "B88(E) W55 H86(168cm)"
    );
  });

  it("omits the cup parenthesis when cup is unset", () => {
    expect(formatBodyStats({ heightCm: 0, bust: 88, waist: 0, hip: 0, cup: "" })).toBe("B88");
  });

  it("shows height alone when there is no hip measurement", () => {
    expect(formatBodyStats({ heightCm: 168, bust: 0, waist: 0, hip: 0, cup: "" })).toBe("168cm");
  });

  it("returns an empty string when nothing is set", () => {
    expect(formatBodyStats({ heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" })).toBe("");
  });
});
