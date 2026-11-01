// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  isBlocked: false,
  toggle: vi.fn(),
}));

vi.mock("@/modules/social/hooks", () => ({
  useBlock: () => ({ isBlocked: mocks.isBlocked, toggle: mocks.toggle, loading: false }),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "viewer-1" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { ProfileMoreMenu } = await import("./ProfileMoreMenu");
const { useToastStore } = await import("@/stores/toastStore");

async function openMenu(onUnfollow?: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(ProfileMoreMenu, { targetProfileId: "target-1", onUnfollow }));
  });
  await act(async () => {
    container
      .querySelector("button")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  return async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
}

const menuItems = () => Array.from(document.querySelectorAll('[role="menuitem"]'));

beforeEach(() => {
  mocks.isBlocked = false;
  mocks.toggle.mockReset().mockResolvedValue(undefined);
  useToastStore.setState({ message: null });
});

describe("ProfileMoreMenu", () => {
  it("renders a labelled trigger for another profile", () => {
    const html = renderToStaticMarkup(<ProfileMoreMenu targetProfileId="target-1" />);

    expect(html).toContain('aria-label="その他の操作"');
  });

  it("renders nothing for the viewer's own profile", () => {
    const html = renderToStaticMarkup(<ProfileMoreMenu targetProfileId="viewer-1" />);

    expect(html).toBe("");
  });

  it("offers block for a profile that is not blocked and toggles it when chosen", async () => {
    const close = await openMenu();

    expect(menuItems().map((item) => item.textContent)).toEqual(["ブロック", "通報"]);
    await act(async () => {
      (menuItems()[0] as HTMLElement).click();
    });
    expect(mocks.toggle).toHaveBeenCalledTimes(1);

    await close();
  });

  it("reports a failed block in a toast", async () => {
    mocks.toggle.mockRejectedValue(new Error("boom"));
    const close = await openMenu();

    await act(async () => {
      (menuItems()[0] as HTMLElement).click();
    });

    expect(useToastStore.getState().message).toBe("ブロックできませんでした");

    await close();
  });

  it("offers unblock for a blocked profile", async () => {
    mocks.isBlocked = true;
    const close = await openMenu();

    expect(menuItems().map((item) => item.textContent)).toEqual(["ブロック解除", "通報"]);

    await close();
  });

  it("offers unfollow before block when an unfollow action is given", async () => {
    const onUnfollow = vi.fn();
    const close = await openMenu(onUnfollow);

    expect(menuItems().map((item) => item.textContent)).toEqual(["フォローを外す", "ブロック", "通報"]);
    await act(async () => {
      (menuItems()[0] as HTMLElement).click();
    });
    expect(onUnfollow).toHaveBeenCalledTimes(1);
    expect(mocks.toggle).not.toHaveBeenCalled();

    await close();
  });
});

describe("ProfileMoreMenu report", () => {
  it("opens the report dialog from the menu", async () => {
    const cleanup = await openMenu();

    const item = menuItems().find((candidate) => candidate.textContent === "通報") as HTMLElement;
    await act(async () => {
      item.click();
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("通報する");
    await cleanup();
  });
});
