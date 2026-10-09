import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const authFetch = vi.fn();
vi.mock("@/lib/auth/fetch", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

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

  it("discards the answer to a like or unlike sent as the previous profile", async () => {
    const answers: ((value: { likesCount: number }) => void)[] = [];
    authFetch.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));

    const liking = usePostLikeStore.getState().like("post-1");
    const unliking = usePostLikeStore.getState().unlike("post-2");
    useAuthStore.getState().setActiveProfile("profile-b");
    answers.forEach((answer) => answer({ likesCount: 5 }));
    await Promise.all([liking, unliking]);

    expect(usePostLikeStore.getState().entries).toEqual({});
  });

  it("records the answer to a like sent as the acting profile", async () => {
    authFetch.mockResolvedValue({ likesCount: 5 });

    await usePostLikeStore.getState().like("post-1");

    expect(usePostLikeStore.getState().entries).toEqual({ "post-1": { liked: true, likesCount: 5 } });
  });

  it("keeps the like state while the acting profile stays the same", () => {
    usePostLikeStore.getState().seed("post-1", true, 3);

    useAuthStore.getState().setHydrated();

    expect(usePostLikeStore.getState().isLiked("post-1")).toBe(true);
  });
});
