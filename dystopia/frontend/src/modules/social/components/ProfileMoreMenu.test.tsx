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

async function openMenu() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(ProfileMoreMenu, { targetProfileId: "target-1" }));
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
  mocks.toggle.mockReset();
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

    expect(menuItems().map((item) => item.textContent)).toEqual(["ブロック"]);
    await act(async () => {
      (menuItems()[0] as HTMLElement).click();
    });
    expect(mocks.toggle).toHaveBeenCalledTimes(1);

    await close();
  });

  it("offers unblock for a blocked profile", async () => {
    mocks.isBlocked = true;
    const close = await openMenu();

    expect(menuItems().map((item) => item.textContent)).toEqual(["ブロック解除"]);

    await close();
  });
});
