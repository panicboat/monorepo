// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { KarteEntry } from "@/modules/karte/types";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); });
vi.mock("@/modules/karte/components/KarteDetailSheet", () => ({ KarteDetailSheet: ({ entryId }: { entryId: string | null }) => entryId ? createElement("div", { role: "dialog" }, `detail:${entryId}`) : null }));
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/feed/hooks/useFeed", () => ({
  useFeed: () => ({
    posts: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    initialized: true,
    fetchInitial: vi.fn(),
    fetchMore: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/modules/profile/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { prefecture: "" } }),
}));

const karteAccessMocks = vi.hoisted(() => ({ useMyKarteAccess: vi.fn() }));
vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({ useMyKarteAccess: karteAccessMocks.useMyKarteAccess }));

const karteMocks = vi.hoisted(() => ({ useRecentKarte: vi.fn() }));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: karteMocks.useRecentKarte }));

const reviewMocks = vi.hoisted(() => ({ useRecentReviews: vi.fn() }));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({ useRecentReviews: reviewMocks.useRecentReviews }));

const { default: HomePage } = await import("./page");

const emptyList = { entries: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };

describe("HomePage tabs", () => {
  it("shows the karte tab when the viewer has karte access", () => {
    karteAccessMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    karteMocks.useRecentKarte.mockReturnValue(emptyList);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("カルテ");
    expect(html).toContain("レビュー");
  });

  it("hides the karte tab when the viewer has no karte access but keeps the review tab", () => {
    karteAccessMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    karteMocks.useRecentKarte.mockReturnValue(emptyList);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).not.toContain("カルテ");
    expect(html).toContain("レビュー");
  });
});


it("shows an open unrated record immediately and opens one detail panel", async () => {
  const entry: KarteEntry = { id: "new-entry", status: "open", authorProfileId: "writer", targetProfileId: "guest", isMine: true, authorUsername: "writer", authorAvatarUrl: "", targetUsername: "guest", targetAvatarUrl: "", rating: null, body: "", flagged: false, closedAt: null, events: [], latestEvent: { id: "event", entryId: "new-entry", stage: "booking", outcome: "confirmed", tags: [], note: "", occurredOn: "2026-10-12", createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z" }, eventCount: 1, createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z" };
  karteAccessMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true }); karteMocks.useRecentKarte.mockReturnValue({ ...emptyList, entries: [entry] }); reviewMocks.useRecentReviews.mockReturnValue(emptyList);
  const container = document.createElement("div"); root = createRoot(container);
  await act(async () => root.render(createElement(HomePage)));
  await act(async () => (Array.from(container.querySelectorAll('[role="tab"]')).find((button) => button.textContent === "カルテ") as HTMLButtonElement).click());
  expect(container.textContent).toContain("記録中"); expect(container.textContent).toContain("未評価"); expect(container.textContent).toContain("予約成立");
  await act(async () => (container.querySelector('button[aria-label="カルテ詳細：guest"]') as HTMLButtonElement).click());
  expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1); expect(container.textContent).toContain("detail:new-entry");
});
