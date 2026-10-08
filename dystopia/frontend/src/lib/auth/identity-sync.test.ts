import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { syncIdentityWithAccount } = await import("./identity-sync");

describe("syncIdentityWithAccount", () => {
  beforeEach(() => {
    memory.clear();
    useAuthStore.getState().clearIdentity();
  });

  it("switches to the server account and maps cast roles", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-old", role: "guest" });
    useAuthStore.getState().setActiveProfile("prof-old");

    syncIdentityWithAccount({ id: "acc-new", role: 2 });

    const state = useAuthStore.getState();
    expect(state.accountId).toBe("acc-new");
    expect(state.role).toBe("cast");
    expect(state.activeProfileId).toBeNull();
  });

  it("maps ROLE_CAST to the cast role", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-old", role: "guest" });

    syncIdentityWithAccount({ id: "acc-new", role: "ROLE_CAST" });

    expect(useAuthStore.getState().role).toBe("cast");
  });

  it("maps other server roles to the guest role", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-old", role: "cast" });

    syncIdentityWithAccount({ id: "acc-new", role: 1 });

    expect(useAuthStore.getState().role).toBe("guest");
  });

  it("keeps the current identity when the account id is unchanged", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "guest" });
    useAuthStore.getState().setActiveProfile("prof-1");

    syncIdentityWithAccount({ id: "acc-1", role: 2 });

    const state = useAuthStore.getState();
    expect(state.accountId).toBe("acc-1");
    expect(state.role).toBe("guest");
    expect(state.activeProfileId).toBe("prof-1");
  });

  it("ignores a missing account or account id", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");
    const before = useAuthStore.getState();

    syncIdentityWithAccount(null);
    syncIdentityWithAccount({ role: 2 });
    syncIdentityWithAccount({ id: "acc-2" });

    expect(useAuthStore.getState()).toMatchObject({
      accountId: before.accountId,
      role: before.role,
      activeProfileId: before.activeProfileId,
    });
  });
});
