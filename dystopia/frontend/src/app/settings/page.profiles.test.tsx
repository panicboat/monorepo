// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/profile/hooks", () => ({
  useProfile: () => ({ profile: emptyProfileView("p1"), loading: false, error: null, saveProfile: vi.fn() }),
}));
vi.mock("@/modules/identity/hooks/useDeactivateAccount", () => ({
  useDeactivateAccount: () => ({ deactivate: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/modules/notifications/components/NotificationSettings", () => ({ NotificationSettings: () => null }));
vi.mock("@/modules/profile/components/PrivacySettings", () => ({ PrivacySettings: () => null }));
vi.mock("@/modules/profile/components/AccountSettings", () => ({ AccountSettings: () => null }));
vi.mock("@/modules/profile/components/AppearanceSettings", () => ({ AppearanceSettings: () => null }));
vi.mock("@/modules/profile/components/ProfileManager", () => ({
  ProfileManager: () => createElement("div", { "data-testid": "profile-manager" }),
}));

const { useAuthStore } = await import("@/stores/authStore");
const { default: SettingsPage } = await import("./page");

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(SettingsPage));
  });
  return {
    container,
    tab: (label: string) => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === label),
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("SettingsPage profile management", () => {
  beforeEach(() => {
    useAuthStore.getState().setHydrated();
  });

  it("gives a cast the profile tab and opens the manager from it", async () => {
    useAuthStore.setState({ accountId: "account-1", role: "cast", activeProfileId: "p1" });
    const view = await mount();

    await act(async () => {
      view.tab("プロフィール")?.click();
    });

    expect(view.container.querySelector('[data-testid="profile-manager"]')).not.toBeNull();
    await view.unmount();
  });

  it("gives a guest no profile tab", async () => {
    useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
    const view = await mount();

    expect(view.tab("通知設定")).toBeDefined();
    expect(view.tab("プロフィール")).toBeUndefined();
    expect(view.container.querySelector('[data-testid="profile-manager"]')).toBeNull();
    await view.unmount();
  });
});
