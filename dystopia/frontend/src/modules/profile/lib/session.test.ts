import { describe, expect, it } from "vitest";
import { isMyProfilesKey, myProfilesKey, resolveProfileSession } from "./session";

const enabled = (id: string) => ({ id, disabled: false });
const disabled = (id: string) => ({ id, disabled: true });

describe("resolveProfileSession", () => {
  it("sends an account with no profile to onboarding", () => {
    expect(resolveProfileSession([], null)).toEqual({ kind: "onboarding" });
  });

  it("sends an account whose profiles are all disabled to onboarding", () => {
    expect(resolveProfileSession([disabled("p1")], "p1")).toEqual({ kind: "onboarding" });
  });

  it("activates the only enabled profile", () => {
    expect(resolveProfileSession([enabled("p1")], null)).toEqual({ kind: "active", profileId: "p1" });
  });

  it("activates the only enabled profile even when another id was stored", () => {
    expect(resolveProfileSession([enabled("p1")], "gone")).toEqual({ kind: "active", profileId: "p1" });
  });

  it("keeps the stored profile when it is still enabled among several", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], "p2")).toEqual({ kind: "active", profileId: "p2" });
  });

  it("asks for a selection instead of picking one when several are enabled and none is stored", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], null)).toEqual({ kind: "select" });
  });

  it("asks for a selection when the stored profile is not in the list", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], "gone")).toEqual({ kind: "select" });
  });

  it("does not keep a stored profile that has been disabled", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2"), disabled("p3")], "p3")).toEqual({ kind: "select" });
    expect(resolveProfileSession([enabled("p1"), disabled("p3")], "p3")).toEqual({ kind: "active", profileId: "p1" });
  });
});

describe("myProfilesKey", () => {
  it("separates the cache per account", () => {
    expect(myProfilesKey("acc-1")).toEqual(["/api/profile/mine", "acc-1"]);
    expect(myProfilesKey("acc-1")).not.toEqual(myProfilesKey("acc-2"));
  });

  it("is recognised by isMyProfilesKey and nothing else is", () => {
    expect(isMyProfilesKey(myProfilesKey("acc-1"))).toBe(true);
    expect(isMyProfilesKey("/api/profile/mine")).toBe(false);
    expect(isMyProfilesKey(["/api/profile", "acc-1"])).toBe(false);
    expect(isMyProfilesKey(null)).toBe(false);
  });
});
