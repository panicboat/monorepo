import { describe, expect, it, vi } from "vitest";
import type { ScopedMutator } from "swr";
import { emptyProfileView } from "@/modules/profile/lib/mappers";
import { addToMyProfiles, isMyProfilesKey, myProfilesKey, resolveProfileSession } from "./session";

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

  it("marks the only enabled profile unavailable when the server denied it", () => {
    expect(resolveProfileSession([enabled("p1")], null, "p1")).toEqual({ kind: "unavailable" });
  });

  it("activates the only enabled profile when a different profile was denied", () => {
    expect(resolveProfileSession([enabled("p1")], null, "p2")).toEqual({ kind: "active", profileId: "p1" });
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

  it("asks for a selection when the stored profile was denied", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], "p1", "p1")).toEqual({ kind: "select" });
  });

  it("keeps the stored profile when another profile was denied", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], "p1", "p2")).toEqual({ kind: "active", profileId: "p1" });
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

describe("addToMyProfiles", () => {
  it("updates only the given account's list and appends the profile without revalidating", async () => {
    const mutateCache = vi.fn(async () => undefined);

    await addToMyProfiles(mutateCache as unknown as ScopedMutator, "acc-1", emptyProfileView("prof-1"));

    const [key, updater, options] = mutateCache.mock.calls[0] as unknown as [
      unknown,
      (current?: { profiles: { id: string }[] }) => { profiles: { id: string }[] },
      unknown,
    ];
    expect(key).toEqual(myProfilesKey("acc-1"));
    expect(typeof key).not.toBe("function");
    expect(updater(undefined).profiles.map((p) => p.id)).toEqual(["prof-1"]);
    expect(updater({ profiles: [{ id: "prof-0" }] }).profiles.map((p) => p.id)).toEqual(["prof-0", "prof-1"]);
    expect(options).toEqual({ revalidate: false });
  });
});
