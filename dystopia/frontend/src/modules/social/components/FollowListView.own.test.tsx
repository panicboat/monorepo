// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emptyList = { profiles: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };
const requestMocks = vi.hoisted(() => ({ pendingCount: 0, enabled: [] as boolean[] }));

vi.mock("@/modules/social/hooks", () => ({
  useFollowList: () => emptyList,
  useFollowerList: () => emptyList,
}));
vi.mock("../hooks/useFollowRequests", () => ({
  useFollowRequests: (options?: { enabled?: boolean }) => {
    requestMocks.enabled.push(options?.enabled ?? true);
    return { pendingCount: requestMocks.pendingCount };
  },
}));
vi.mock("./FollowButton", () => ({ FollowButton: () => null }));
vi.mock("./BlockedAccountsList", () => ({
  BlockedAccountsList: () => createElement("div", { "data-testid": "blocked-list" }),
}));
vi.mock("./FollowRequestsList", () => ({
  FollowRequestsList: () => createElement("div", { "data-testid": "requests-list" }),
}));

const { FollowListView } = await import("./FollowListView");

async function mount(props: { isOwnProfile: boolean; initialTab?: "following" | "followers" | "requests" }) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(FollowListView, { profileId: "p1", ...props }));
  });
  const tabs = () => Array.from(container.querySelectorAll('[role="tab"]'), (tab) => tab.textContent);
  const select = (label: string) =>
    act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent === label) as HTMLElement).click();
    });
  return { container, tabs, select, unmount: () => act(async () => root.unmount()) };
}

describe("FollowListView on the viewer's own lists", () => {
  it("adds the requests and blocked tabs and shows each list in its tab", async () => {
    requestMocks.pendingCount = 0;
    const own = await mount({ isOwnProfile: true });

    expect(own.tabs()).toEqual(["フォロー中", "フォロワー", "申請", "ブロック中"]);
    await own.select("申請");
    expect(own.container.querySelector('[data-testid="requests-list"]')).not.toBeNull();
    await own.select("ブロック中");
    expect(own.container.querySelector('[data-testid="blocked-list"]')).not.toBeNull();
    await own.unmount();
  });

  it("counts pending requests in the tab name", async () => {
    requestMocks.pendingCount = 2;
    const own = await mount({ isOwnProfile: true });

    expect(own.tabs()).toContain("申請(2)");
    await own.unmount();
  });

  it("opens on the requests tab when asked", async () => {
    const own = await mount({ isOwnProfile: true, initialTab: "requests" });

    expect(own.container.querySelector('[data-testid="requests-list"]')).not.toBeNull();
    await own.unmount();
  });
});

describe("FollowListView on someone else's lists", () => {
  it("offers only following and followers, skips loading requests and ignores a requests tab in the URL", async () => {
    requestMocks.enabled.length = 0;
    const other = await mount({ isOwnProfile: false, initialTab: "requests" });

    expect(other.tabs()).toEqual(["フォロー中", "フォロワー"]);
    expect(other.container.querySelector('[data-testid="requests-list"]')).toBeNull();
    expect(other.container.textContent).toContain("フォロー中のアカウントはまだいません。");
    expect(requestMocks.enabled.every((enabled) => enabled === false)).toBe(true);
    await other.unmount();
  });
});
