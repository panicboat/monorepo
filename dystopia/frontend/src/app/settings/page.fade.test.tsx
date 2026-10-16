// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ keys: [] as string[] }));

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    mocks.keys.push(key);
  },
}));
vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: { id: "p-1" }, loading: false, error: undefined, saveProfile: vi.fn() }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { isHydrated: boolean; role: string }) => unknown) => selector({ isHydrated: true, role: "guest" }),
  selectIsHydrated: (state: { isHydrated: boolean }) => state.isHydrated,
  selectRole: (state: { role: string }) => state.role,
}));
vi.mock("@/modules/notifications/components/NotificationSettings", () => ({ NotificationSettings: () => <div>notifications</div> }));
vi.mock("@/modules/profile/components/PrivacySettings", () => ({ PrivacySettings: () => <div>privacy</div> }));
vi.mock("@/modules/profile/components/AppearanceSettings", () => ({ AppearanceSettings: () => <div>appearance</div> }));
vi.mock("@/modules/profile/components/AccountSettings", () => ({ AccountSettings: () => <div>account</div> }));
vi.mock("@/modules/profile/components/ProfileManager", () => ({ ProfileManager: () => <div>profiles</div> }));
vi.mock("@/modules/identity/hooks/useDeactivateAccount", () => ({ useDeactivateAccount: () => ({ deactivate: vi.fn(), loading: false, error: null }) }));

const { default: SettingsPage } = await import("./page");

describe("SettingsPage tab fade", () => {
  it("keys the enter animation by the selected tab", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(SettingsPage));
    });
    expect(mocks.keys.at(-1)).toBe("notifications");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "プライバシー") as HTMLElement).click();
    });

    expect(mocks.keys.at(-1)).toBe("privacy");
  });
});
