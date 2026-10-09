import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { profileRequestHeaders, PROFILE_ID_HEADER } = await import("./profile-headers");

describe("profileRequestHeaders", () => {
  beforeEach(() => {
    memory.clear();
    useAuthStore.getState().clearIdentity();
  });

  it("returns the acting profile as x-profile-id", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    expect(PROFILE_ID_HEADER).toBe("x-profile-id");
    expect(profileRequestHeaders()).toEqual({ "x-profile-id": "prof-1" });
  });

  it("returns no header when no profile is active", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });

    expect(profileRequestHeaders()).toEqual({});
  });

  it("never sends the account id", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    expect(Object.values(profileRequestHeaders())).not.toContain("acc-1");
  });
});
