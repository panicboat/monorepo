import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const swrMocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("swr", () => ({ mutate: swrMocks.mutate }));

const { useAuthStore } = await import("@/stores/authStore");
const { isMyProfilesKey } = await import("@/modules/profile/lib/session");
const { isProfileSelectionError, resetProfileSelection, PROFILE_REQUIRED, PROFILE_NOT_PERMITTED } = await import("./profile-errors");

describe("isProfileSelectionError", () => {
  it("is true only for the two profile reason codes", () => {
    expect(isProfileSelectionError({ error: "x", code: PROFILE_REQUIRED })).toBe(true);
    expect(isProfileSelectionError({ error: "x", code: PROFILE_NOT_PERMITTED })).toBe(true);
  });

  it("is false for an error without a reason code", () => {
    expect(isProfileSelectionError({ error: "フォローが必要です" })).toBe(false);
    expect(isProfileSelectionError({})).toBe(false);
    expect(isProfileSelectionError(null)).toBe(false);
    expect(isProfileSelectionError("profile_required")).toBe(false);
  });

  it("is false for an unrelated code", () => {
    expect(isProfileSelectionError({ error: "x", code: "limit_exceeded" })).toBe(false);
  });
});

describe("resetProfileSelection", () => {
  beforeEach(() => {
    memory.clear();
    swrMocks.mutate.mockReset();
    useAuthStore.getState().clearIdentity();
  });

  it("drops the profile it sent and revalidates the profile list and identity", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    resetProfileSelection("prof-1");

    expect(useAuthStore.getState().activeProfileId).toBeNull();
    expect(useAuthStore.getState().deniedProfileId).toBe("prof-1");
    expect(useAuthStore.getState().accountId).toBe("acc-1");
    expect(swrMocks.mutate).toHaveBeenCalledWith(isMyProfilesKey, undefined, { revalidate: true });
    expect(swrMocks.mutate).toHaveBeenCalledWith("/api/identity/me");
  });

  it("ignores a rejection for a profile that is no longer active", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    resetProfileSelection("prof-old");

    expect(useAuthStore.getState().activeProfileId).toBe("prof-1");
    expect(useAuthStore.getState().deniedProfileId).toBeNull();
    expect(swrMocks.mutate).not.toHaveBeenCalled();
  });

  it("revalidates when a request without an active profile is rejected", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });

    resetProfileSelection(null);

    expect(useAuthStore.getState().activeProfileId).toBeNull();
    expect(useAuthStore.getState().deniedProfileId).toBeNull();
    expect(swrMocks.mutate).toHaveBeenCalledWith(isMyProfilesKey, undefined, { revalidate: true });
    expect(swrMocks.mutate).toHaveBeenCalledWith("/api/identity/me");
  });
});
