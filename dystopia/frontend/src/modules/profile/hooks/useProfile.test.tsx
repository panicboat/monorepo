// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authMocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: authMocks.authFetch }));

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { useProfile } = await import("./useProfile");
const { AccountProfilesProvider } = await import("@/modules/profile/context/AccountProfilesContext");

describe("useProfile createProfile", () => {
  beforeEach(() => {
    memory.clear();
    authMocks.authFetch.mockReset();
    useAuthStore.getState().clearIdentity();
    useAuthStore.getState().setIdentity({ accountId: "account-A", role: "cast" });
  });

  it("does not activate a created profile after the identity was cleared", async () => {
    const profile = emptyProfileView("p1");
    authMocks.authFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") useAuthStore.getState().clearIdentity();
      return { profile };
    });
    let createProfile: ReturnType<typeof useProfile>["createProfile"] | undefined;
    const Probe = () => {
      createProfile = useProfile().createProfile;
      return null;
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(Probe));
    });
    let created: typeof profile | undefined;
    await act(async () => {
      created = await createProfile!({ displayName: "Name", username: "name" });
    });

    expect(created).toEqual(profile);
    expect(useAuthStore.getState().accountId).toBeNull();
    expect(useAuthStore.getState().activeProfileId).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("useProfile saving", () => {
  beforeEach(() => {
    memory.clear();
    authMocks.authFetch.mockReset();
    authMocks.authFetch.mockResolvedValue({ profile: emptyProfileView("p1") });
    useAuthStore.getState().clearIdentity();
    useAuthStore.getState().setIdentity({ accountId: "account-A", role: "cast" });
    useAuthStore.getState().setActiveProfile("p1");
  });

  it("refreshes the account's profile list after the name or the images change", async () => {
    const refresh = vi.fn(async () => {});
    let api: ReturnType<typeof useProfile> | undefined;
    const Probe = () => {
      api = useProfile();
      return null;
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          AccountProfilesProvider,
          { value: { profiles: [], switchProfile: () => {}, refresh, append: async () => {} } },
          createElement(Probe)
        )
      );
    });

    await act(async () => {
      await api!.saveProfile({ displayName: "Renamed" });
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await api!.saveMedia({ avatarMediaId: "media-1" });
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
