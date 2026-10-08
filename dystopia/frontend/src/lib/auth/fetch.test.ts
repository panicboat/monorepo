import { beforeEach, describe, expect, it, vi } from "vitest";

const profileErrorMocks = vi.hoisted(() => ({ resetProfileSelection: vi.fn() }));
vi.mock("@/lib/auth/profile-errors", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/profile-errors")>();
  return { ...original, resetProfileSelection: profileErrorMocks.resetProfileSelection };
});

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { AppError } = await import("@/lib/errors");
const { authFetch } = await import("./fetch");

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authFetch", () => {
  beforeEach(() => {
    memory.clear();
    useAuthStore.getState().clearIdentity();
    profileErrorMocks.resetProfileSelection.mockReset();
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { ok: true })));
  });

  it("sends the active profile in x-profile-id", async () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    await authFetch("/api/test");

    expect(fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ headers: { "x-profile-id": "prof-1" } })
    );
  });

  it("omits x-profile-id when no profile is active", async () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });

    await authFetch("/api/test");

    expect(fetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({ headers: {} }));
  });

  it("passes the profile id sent on a rejected request to resetProfileSelection", async () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect((init?.headers as Record<string, string>)?.["x-profile-id"]).toBe("prof-1");
        useAuthStore.getState().setActiveProfile("prof-2");
        return json(403, { error: "forbidden", code: "profile_not_permitted" });
      })
    );

    await expect(authFetch("/api/test")).rejects.toMatchObject({ status: 403 });

    expect(profileErrorMocks.resetProfileSelection).toHaveBeenCalledWith("prof-1");
  });

  it("passes null when a profile-required error came from a request without a profile", async () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { error: "profile required", code: "profile_required" })));

    await expect(authFetch("/api/test")).rejects.toMatchObject({ status: 422 });

    expect(profileErrorMocks.resetProfileSelection).toHaveBeenCalledWith(null);
  });

  it("does not reset the profile for other error bodies", async () => {
    const bodies = [
      { status: 403, body: { error: "forbidden" } },
      { status: 422, body: { error: "invalid" } },
      { status: 403, body: { error: "forbidden", code: "limit_exceeded" } },
      { status: 422, body: { error: "invalid", code: "other" } },
    ];

    for (const { status, body } of bodies) {
      vi.stubGlobal("fetch", vi.fn(async () => json(status, body)));
      await expect(authFetch("/api/test", { requireAuth: false })).rejects.toBeInstanceOf(AppError);
    }

    expect(profileErrorMocks.resetProfileSelection).not.toHaveBeenCalled();
  });

  it("preserves the response status on the thrown AppError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { error: "forbidden" })));

    await expect(authFetch("/api/test", { requireAuth: false })).rejects.toMatchObject({
      name: "AppError",
      status: 403,
    });
  });

  it("rejects a required-auth request before fetching when no account exists", async () => {
    const fetchMock = vi.fn(async () => json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(authFetch("/api/test")).rejects.toMatchObject({ name: "AppError", status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
