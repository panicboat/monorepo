// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";
import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";
import { useAuthStore } from "@/stores/authStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { ProfileSwitcher } = await import("./ProfileSwitcher");

const profile = (id: string, username: string, disabled = false) => ({ ...emptyProfileView(id), username, displayName: username, disabled });

function tree(profiles: ReturnType<typeof profile>[], switchProfile = vi.fn()) {
  return createElement(
    AccountProfilesProvider,
    { value: { profiles, switchProfile, refresh: async () => {} } },
    createElement(ProfileSwitcher)
  );
}

async function render(profiles: ReturnType<typeof profile>[] | null, switchProfile = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(profiles ? tree(profiles, switchProfile) : createElement(ProfileSwitcher));
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("ProfileSwitcher", () => {
  beforeEach(() => {
    useAuthStore.setState({ activeProfileId: "p1" });
  });

  it("offers the other enabled profiles and not the acting or a disabled one", async () => {
    const view = await render([profile("p1", "first"), profile("p2", "second"), profile("p3", "third", true)]);

    expect(view.container.textContent).toContain("@second");
    expect(view.container.textContent).not.toContain("@first");
    expect(view.container.textContent).not.toContain("@third");
    await view.unmount();
  });

  it("renders nothing when there is no other enabled profile", async () => {
    const onlyDisabledOthers = await render([profile("p1", "first"), profile("p3", "third", true)]);
    const outsideTheShell = await render(null);

    expect(onlyDisabledOthers.container.innerHTML).toBe("");
    expect(outsideTheShell.container.innerHTML).toBe("");
    await onlyDisabledOthers.unmount();
    await outsideTheShell.unmount();
  });

  it("switches to the profile that was clicked", async () => {
    const switchProfile = vi.fn();
    const view = await render([profile("p1", "first"), profile("p2", "second")], switchProfile);

    await act(async () => {
      view.container.querySelector("button")?.click();
    });

    expect(switchProfile.mock.calls).toEqual([["p2"]]);
    await view.unmount();
  });
});
