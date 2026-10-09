import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("./authStore");
const { usePostLikeStore } = await import("./postLikeStore");

describe("postLikeStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ accountId: "account-1", activeProfileId: "profile-a" });
    usePostLikeStore.setState({ entries: {} });
  });

  it("drops the like state of the previous profile when the acting profile changes", () => {
    usePostLikeStore.getState().seed("post-1", true, 3);

    useAuthStore.getState().setActiveProfile("profile-b");
    usePostLikeStore.getState().seed("post-1", false, 3);

    expect(usePostLikeStore.getState().isLiked("post-1")).toBe(false);
  });

  it("keeps the like state while the acting profile stays the same", () => {
    usePostLikeStore.getState().seed("post-1", true, 3);

    useAuthStore.getState().setHydrated();

    expect(usePostLikeStore.getState().isLiked("post-1")).toBe(true);
  });
});
