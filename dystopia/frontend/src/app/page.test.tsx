import { describe, expect, it, vi } from "vitest";
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
