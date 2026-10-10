import { describe, expect, it } from "vitest";
import { petalAt, petalPositions } from "./flowerGeometry";

const xy = (positions: { x: number; y: number }[]) => positions.map(({ x, y }) => [x, y]);

describe("petalPositions", () => {
  it("fans three petals from straight up to straight left for a corner trigger", () => {
    expect(xy(petalPositions(3, "up-left", 96))).toEqual([[0, -96], [-68, -68], [-96, 0]]);
  });

  it("fans three petals above a wide trigger from left to right", () => {
    expect(xy(petalPositions(3, "up", 92))).toEqual([[-65, -65], [0, -92], [65, -65]]);
  });

  it("puts a single petal in the middle of the arc", () => {
    expect(xy(petalPositions(1, "up-left", 96))).toEqual([[-68, -68]]);
    expect(xy(petalPositions(1, "up", 92))).toEqual([[0, -92]]);
  });

  it("places each label further out along the direction of its petal for a corner trigger", () => {
    const [top, , left] = petalPositions(3, "up-left", 96);

    expect([top.labelX, top.labelY]).toEqual([0, -41]);
    expect([left.labelX, left.labelY]).toEqual([-64, 0]);
  });

  it("places every label straight above its petal for a wide trigger", () => {
    expect(petalPositions(3, "up", 92).map(({ labelX, labelY }) => [labelX, labelY])).toEqual([[0, -41], [0, -41], [0, -41]]);
  });
});

describe("petalAt", () => {
  const petals = petalPositions(3, "up-left", 96);

  it("finds the petal under the pointer", () => {
    expect(petalAt(0, -90, petals)).toBe(0);
    expect(petalAt(-60, -70, petals)).toBe(1);
    expect(petalAt(-100, 5, petals)).toBe(2);
  });

  it("finds nothing while the pointer is still on the trigger", () => {
    expect(petalAt(0, 0, petals)).toBe(-1);
    expect(petalAt(-10, -20, petals)).toBe(-1);
  });

  it("finds nothing when the pointer is far from every petal", () => {
    expect(petalAt(120, 120, petals)).toBe(-1);
    expect(petalAt(-260, -260, petals)).toBe(-1);
  });
});
