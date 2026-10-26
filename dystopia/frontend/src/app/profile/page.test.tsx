// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { isHydrated: boolean }) => unknown) => selector({ isHydrated: true }),
  selectIsHydrated: (state: { isHydrated: boolean }) => state.isHydrated,
}));
vi.mock("@/modules/profile/hooks", () => ({
  useProfile: () => ({ profile: { id: "p-1", username: "", role: 1 }, loading: false, error: undefined, saveProfile: vi.fn(), saveMedia: vi.fn() }),
}));
vi.mock("@/modules/profile/components/EditProfileSheet", () => ({
  EditProfileSheet: ({ open }: { open: boolean }) => <div>edit-sheet:{String(open)}</div>,
}));

const { default: ProfilePage } = await import("./page");

describe("ProfilePage", () => {
  it("opens the edit sheet where a profile without a username can set one", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(ProfilePage));
    });

    expect(container.textContent).toContain("ユーザー名の設定が必要です");
    expect(container.textContent).not.toContain("edit-sheet:");
    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "ユーザー名を設定") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("edit-sheet:true");
  });
});
