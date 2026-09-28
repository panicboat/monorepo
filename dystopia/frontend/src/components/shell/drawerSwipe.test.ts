import { describe, expect, it } from "vitest";
import { classifySwipeDirection, clampDrawerOffset, shouldToggleDrawer } from "./drawerSwipe";

describe("classifySwipeDirection", () => {
  it("stays pending while movement is within the threshold", () => {
    expect(classifySwipeDirection(5, 5)).toBe("pending");
  });

  it("locks horizontal once dx dominates past the threshold", () => {
    expect(classifySwipeDirection(30, 4)).toBe("horizontal");
  });

  it("locks vertical once dy dominates past the threshold", () => {
    expect(classifySwipeDirection(4, 30)).toBe("vertical");
  });
});

describe("clampDrawerOffset", () => {
  it("clamps to fully open when the drag overshoots past 0", () => {
    expect(clampDrawerOffset(-320, 400, 320)).toBe(0);
  });

  it("clamps to fully closed when the drag overshoots past -width", () => {
    expect(clampDrawerOffset(0, -400, 320)).toBe(-320);
  });

  it("applies dx to baseOffset within bounds", () => {
    expect(clampDrawerOffset(-320, 120, 320)).toBe(-200);
  });
});

describe("shouldToggleDrawer", () => {
  it("commits to opening once dragged past a third of the width from closed", () => {
    expect(shouldToggleDrawer(150, 320, false)).toBe(true);
  });

  it("does not open on a short rightward drag from closed", () => {
    expect(shouldToggleDrawer(50, 320, false)).toBe(false);
  });

  it("ignores leftward drag when starting closed", () => {
    expect(shouldToggleDrawer(-150, 320, false)).toBe(false);
  });

  it("commits to closing once dragged past a third of the width from open", () => {
    expect(shouldToggleDrawer(-150, 320, true)).toBe(true);
  });

  it("does not close on a short leftward drag from open", () => {
    expect(shouldToggleDrawer(-50, 320, true)).toBe(false);
  });

  it("ignores rightward drag when starting open", () => {
    expect(shouldToggleDrawer(150, 320, true)).toBe(false);
  });

  it("never toggles when the drawer width is unknown", () => {
    expect(shouldToggleDrawer(200, 0, false)).toBe(false);
  });
});
