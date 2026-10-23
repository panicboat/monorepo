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

describe("SettingsPage tabs", () => {
  beforeEach(() => {
    useAuthStore.getState().setHydrated();
  });

  it.each(["cast", "guest"] as const)("gives a %s only the profile and appearance tabs", async (role) => {
    useAuthStore.setState({ accountId: "account-1", role, activeProfileId: "p1" });
    const view = await mount();
    const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'), (tab) => tab.textContent);

    expect(tabs).toEqual(["プロフィール", "外観"]);
    await view.unmount();
  });

  it("opens on the profile manager with the deactivation below it", async () => {
    useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
    const view = await mount();

    expect(view.container.querySelector('[data-testid="profile-manager"]')).not.toBeNull();
    expect(view.container.textContent).toContain("アカウントを退会");
    await view.unmount();
  });

  it("says deactivation is undone by logging in before the data is deleted", async () => {
    useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
    const view = await mount();

    expect(view.container.textContent).toContain(
      "退会すると、すべてのプロフィールが他の利用者に表示されなくなり、アカウントの情報は後日削除されます。書いたクチコミとカルテは、名前を伏せて残ります。消したい場合は、退会の前に削除してください。削除が済むまでの間に同じ電話番号でログインすると、退会は取り消されます。"
    );
    await view.unmount();
  });

  it("says the reviews and the karte stay without a name in the confirmation too", async () => {
    useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
    const view = await mount();

    await act(async () => {
      Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent === "退会する")?.click();
    });

    const dialog = view.container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(
      "退会すると、すべてのプロフィールが他の利用者に表示されなくなり、アカウントの情報は後日削除されます。書いたクチコミとカルテは、名前を伏せて残ります。消したい場合は、退会の前に削除してください。削除が済むまでの間に同じ電話番号でログインすると、退会は取り消されます。"
    );
    await view.unmount();
  });

  it("leaves the deactivation off the appearance tab", async () => {
    useAuthStore.setState({ accountId: "account-1", role: "cast", activeProfileId: "p1" });
    const view = await mount();

    await act(async () => {
      view.tab("外観")?.click();
    });

    expect(view.container.querySelector('[data-testid="profile-manager"]')).toBeNull();
    expect(view.container.textContent).not.toContain("アカウントを退会");
    await view.unmount();
  });

  it.each(["プロフィール", "外観"])("links to the terms and the privacy policy on the %s tab", async (label) => {
    useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
    const view = await mount();

    await act(async () => {
      view.tab(label)?.click();
    });

    expect(view.container.querySelector('a[href="/terms"]')?.textContent).toBe("利用規約");
    expect(view.container.querySelector('a[href="/privacy"]')?.textContent).toBe("プライバシーポリシー");
    await view.unmount();
  });
});
