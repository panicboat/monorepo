// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emptyList = { profiles: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };

vi.mock("@/modules/social/hooks", () => ({
  useFollowList: () => emptyList,
  useFollowerList: () => emptyList,
}));
vi.mock("./FollowButton", () => ({ FollowButton: () => null }));
vi.mock("./BlockedAccountsList", () => ({
  BlockedAccountsList: () => createElement("div", { "data-testid": "blocked-list" }),
}));

const { FollowListView } = await import("./FollowListView");

async function mount(showBlocked: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(FollowListView, { profileId: "p1", showBlocked }));
  });
  const tabs = () => Array.from(container.querySelectorAll('[role="tab"]'), (tab) => tab.textContent);
  return { container, tabs, unmount: () => act(async () => root.unmount()) };
}

describe("FollowListView blocked tab", () => {
  it("adds the blocked tab only when asked and shows the blocked accounts in it", async () => {
    const own = await mount(true);

    expect(own.tabs()).toEqual(["フォロー中", "フォロワー", "ブロック"]);
    expect(own.container.querySelector('[data-testid="blocked-list"]')).toBeNull();
    await act(async () => {
      (Array.from(own.container.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent === "ブロック") as HTMLElement).click();
    });
    expect(own.container.querySelector('[data-testid="blocked-list"]')).not.toBeNull();
    await own.unmount();

    const other = await mount(false);
    expect(other.tabs()).toEqual(["フォロー中", "フォロワー"]);
    await other.unmount();
  });
});
