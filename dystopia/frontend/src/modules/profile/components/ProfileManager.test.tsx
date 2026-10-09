// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";
import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const log: string[] = [];
const authFetch = vi.fn();
vi.mock("@/lib/auth/fetch", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

const { useAuthStore } = await import("@/stores/authStore");
const { ProfileManager } = await import("./ProfileManager");

const profile = (id: string, username: string, disabled = false) => ({ ...emptyProfileView(id), username, displayName: username, disabled });
const profiles = [profile("p1", "first"), profile("p2", "second"), profile("p3", "third", true)];
const switchProfile = vi.fn((profileId: string) => void log.push(`switch ${profileId}`));
const refresh = vi.fn(async () => void log.push("refresh"));

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(AccountProfilesProvider, { value: { profiles, switchProfile, refresh } }, createElement(ProfileManager)));
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

function row(container: HTMLElement, username: string) {
  const item = Array.from(container.querySelectorAll("li")).find((li) => li.textContent?.includes(`@${username}`));
  if (!item) throw new Error(`no row for @${username}`);
  return item;
}

function labels(element: Element) {
  return Array.from(element.querySelectorAll("button")).map((button) => button.textContent);
}

async function click(scope: ParentNode, label: string) {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`no button labelled ${label}`);
  await act(async () => {
    button.click();
  });
}

async function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ProfileManager", () => {
  beforeEach(() => {
    log.length = 0;
    authFetch.mockReset();
    authFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
      log.push(`${options?.method ?? "GET"} ${url}`);
      return { profile: profile("p4", "fourth") };
    });
    switchProfile.mockClear();
    refresh.mockClear();
    useAuthStore.setState({ accountId: "account-1", role: "cast", activeProfileId: "p1" });
  });

  it("offers each profile only the changes its state allows", async () => {
    const view = await mount();

    expect(row(view.container, "first").textContent).toContain("使用中");
    expect(labels(row(view.container, "first"))).toEqual([]);
    expect(labels(row(view.container, "second"))).toEqual(["切り替える", "無効にする"]);
    expect(row(view.container, "third").textContent).toContain("無効");
    expect(labels(row(view.container, "third"))).toEqual(["有効にする", "削除する"]);
    await view.unmount();
  });

  it("switches to an enabled profile", async () => {
    const view = await mount();

    await click(row(view.container, "second"), "切り替える");

    expect(log).toEqual(["switch p2"]);
    await view.unmount();
  });

  it("disables and enables through the routes and then refreshes the list", async () => {
    const view = await mount();

    await click(row(view.container, "second"), "無効にする");
    await click(row(view.container, "third"), "有効にする");

    expect(log).toEqual(["POST /api/profile/p2/disable", "refresh", "POST /api/profile/p3/enable", "refresh"]);
    await view.unmount();
  });

  it("deletes a disabled profile only after the confirmation", async () => {
    const view = await mount();

    await click(row(view.container, "third"), "削除する");
    expect(log).toEqual([]);
    expect(document.body.textContent).toContain("@third を削除しますか？");
    expect(document.body.textContent).toContain("カルテの記録は残ります");

    const dialog = document.body.querySelector('[role="dialog"]');
    if (!dialog) throw new Error("the confirmation did not open");
    await click(dialog, "削除する");

    expect(log).toEqual(["DELETE /api/profile/p3", "refresh"]);
    await view.unmount();
  });

  it("leaves the profile alone when the confirmation is cancelled", async () => {
    const view = await mount();

    await click(row(view.container, "third"), "削除する");
    const dialog = document.body.querySelector('[role="dialog"]');
    if (!dialog) throw new Error("the confirmation did not open");
    await click(dialog, "キャンセル");

    expect(log).toEqual([]);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await view.unmount();
  });

  it("adds a profile, refreshes the list and only then switches to it", async () => {
    const view = await mount();

    await click(view.container, "プロフィールを追加");
    await type(view.container.querySelector("#displayName") as HTMLInputElement, "Fourth");
    await type(view.container.querySelector("#username") as HTMLInputElement, "fourth");
    await act(async () => {
      view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(authFetch.mock.calls[0]).toEqual(["/api/profile", { method: "POST", body: { displayName: "Fourth", username: "fourth" } }]);
    expect(log).toEqual(["POST /api/profile", "refresh", "switch p4"]);
    await view.unmount();
  });

  it("shows the reason and keeps the list when a change is refused", async () => {
    authFetch.mockRejectedValue(new Error("入力内容を確認してください"));
    const view = await mount();

    await click(row(view.container, "second"), "無効にする");

    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("入力内容を確認してください");
    expect(refresh).not.toHaveBeenCalled();
    await view.unmount();
  });
});
