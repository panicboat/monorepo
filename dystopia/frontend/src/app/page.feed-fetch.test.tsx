// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const feedMocks = vi.hoisted(() => ({ fetchInitial: vi.fn(), reset: vi.fn() }));
vi.mock("@/modules/feed/hooks/useFeed", () => ({
  useFeed: () => ({
    posts: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    initialized: true,
    fetchInitial: feedMocks.fetchInitial,
    fetchMore: vi.fn(),
    reset: feedMocks.reset,
  }),
}));

const profileMocks = vi.hoisted(() => ({ useProfile: vi.fn() }));
vi.mock("@/modules/profile/hooks/useProfile", () => ({ useProfile: profileMocks.useProfile }));

const emptyList = { entries: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };
vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({ useMyKarteAccess: () => ({ hasAccess: false }) }));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: () => emptyList }));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({ useRecentReviews: () => emptyList }));

const { default: HomePage } = await import("./page");

async function renderAndOpenAreaTab() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<HomePage />);
  });
  const areaTab = Array.from(container.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent === "エリア");
  await act(async () => {
    (areaTab as HTMLButtonElement).click();
  });
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

describe("HomePage feed fetch", () => {
  beforeEach(() => {
    feedMocks.fetchInitial.mockClear();
  });

  it("does not fetch the area feed when the viewer has no prefecture", async () => {
    profileMocks.useProfile.mockReturnValue({ profile: { prefecture: "" } });

    await renderAndOpenAreaTab();

    expect(feedMocks.fetchInitial).toHaveBeenCalledTimes(1);
  });

  it("fetches the area feed when the viewer has a prefecture", async () => {
    profileMocks.useProfile.mockReturnValue({ profile: { prefecture: "東京都" } });

    await renderAndOpenAreaTab();

    expect(feedMocks.fetchInitial).toHaveBeenCalledTimes(2);
  });
});
