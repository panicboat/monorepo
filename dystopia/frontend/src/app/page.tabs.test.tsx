// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ enterKeys: [] as string[] }));

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    mocks.enterKeys.push(key);
  },
}));
vi.mock("@/modules/feed/hooks/useFeed", () => ({
  useFeed: () => ({
    posts: [], loading: false, loadingMore: false, error: null, hasMore: false, initialized: true,
    fetchInitial: vi.fn(), fetchMore: vi.fn(), reset: vi.fn(),
  }),
}));
vi.mock("@/modules/profile/hooks/useProfile", () => ({ useProfile: () => ({ profile: { prefecture: "" } }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign(
    (selector: (state: { role: string }) => unknown) => selector({ role: "cast" }),
    { subscribe: () => () => {}, getState: () => ({}) },
  ),
  selectRole: (state: { role: string }) => state.role,
}));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({
  useRecentKarte: () => ({ kartes: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({
  useRecentReviews: () => ({ reviews: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/karte/components/KarteList", () => ({ KarteList: () => <div>karte-list</div> }));

const { default: HomePage } = await import("./page");

async function selectTab(container: HTMLElement, label: string) {
  await act(async () => {
    (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === label) as HTMLElement).click();
  });
}

describe("HomePage tab content", () => {
  it("fades the content on each tab and explains the karte and review tabs", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(HomePage));
    });
    expect(mocks.enterKeys.at(-1)).toBe("all");

    await selectTab(container, "カルテ");
    expect(mocks.enterKeys.at(-1)).toBe("karte");
    expect(container.textContent).toContain("キャストがゲストについて残した新着のカルテです。");

    await selectTab(container, "クチコミ");
    expect(mocks.enterKeys.at(-1)).toBe("reviews");
    expect(container.textContent).toContain("ゲストがキャストについて残した新着のクチコミです。");
  });
});
