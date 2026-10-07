import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore, migrateAuthState, selectAccountId, selectActiveProfileId, selectIsAuthenticated } =
  await import("./authStore");

describe("authStore", () => {
  beforeEach(() => {
    memory.clear();
    useAuthStore.getState().clearIdentity();
  });

  it("keeps the account and the acting profile as separate values", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    const state = useAuthStore.getState();
    expect(selectAccountId(state)).toBe("acc-1");
    expect(selectActiveProfileId(state)).toBe("prof-1");
  });

  it("is authenticated with an account even before a profile is active", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "guest" });

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(selectActiveProfileId(useAuthStore.getState())).toBeNull();
  });

  it("keeps the acting profile when the same account signs in again", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });

    expect(selectActiveProfileId(useAuthStore.getState())).toBe("prof-1");
  });

  it("drops the acting profile when a different account signs in", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    useAuthStore.getState().setIdentity({ accountId: "acc-2", role: "guest" });

    expect(selectAccountId(useAuthStore.getState())).toBe("acc-2");
    expect(selectActiveProfileId(useAuthStore.getState())).toBeNull();
  });

  it("clears the account, the role and the acting profile together", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    useAuthStore.getState().clearIdentity();

    const state = useAuthStore.getState();
    expect(state.accountId).toBeNull();
    expect(state.role).toBeNull();
    expect(state.activeProfileId).toBeNull();
    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it("persists only the identity fields", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    const stored = JSON.parse(memory.get("frontend-auth") as string);
    expect(stored.state).toEqual({ role: "cast", accountId: "acc-1", activeProfileId: "prof-1" });
  });
});

describe("migrateAuthState", () => {
  it("carries a stored userId over as the account id with no acting profile", () => {
    expect(migrateAuthState({ role: "cast", userId: "acc-1" })).toEqual({
      role: "cast",
      accountId: "acc-1",
      activeProfileId: null,
    });
  });

  it("returns an empty identity for missing state", () => {
    expect(migrateAuthState(undefined)).toEqual({ role: null, accountId: null, activeProfileId: null });
  });
});
