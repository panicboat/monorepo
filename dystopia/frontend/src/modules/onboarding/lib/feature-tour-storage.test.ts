import { describe, expect, it } from "vitest";
import { hasSeenFeatureTour, markFeatureTourSeen } from "./feature-tour-storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("hasSeenFeatureTour", () => {
  it("returns false when the flag has never been set", () => {
    expect(hasSeenFeatureTour(fakeStorage())).toBe(false);
  });

  it("returns true after markFeatureTourSeen wrote the flag", () => {
    const storage = fakeStorage();
    markFeatureTourSeen(storage);

    expect(hasSeenFeatureTour(storage)).toBe(true);
  });
});
