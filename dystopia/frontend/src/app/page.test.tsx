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

const authMocks = vi.hoisted(() => ({ useAuthStore: vi.fn() }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: authMocks.useAuthStore,
  selectRole: (s: { role: string | null }) => s.role,
}));

const karteMocks = vi.hoisted(() => ({ useRecentKarte: vi.fn() }));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: karteMocks.useRecentKarte }));

const reviewMocks = vi.hoisted(() => ({ useRecentReviews: vi.fn() }));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({ useRecentReviews: reviewMocks.useRecentReviews }));

const { default: HomePage } = await import("./page");

const emptyList = { entries: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };

describe("HomePage tabs", () => {
  it("shows the karte tab for a Cast viewer", () => {
    authMocks.useAuthStore.mockReturnValue("cast");
    karteMocks.useRecentKarte.mockReturnValue(emptyList);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("カルテ");
    expect(html).toContain("レビュー");
  });

  it("hides the karte tab for a Guest viewer but keeps the review tab", () => {
    authMocks.useAuthStore.mockReturnValue("guest");
    karteMocks.useRecentKarte.mockReturnValue(emptyList);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).not.toContain("カルテ");
    expect(html).toContain("レビュー");
  });
});
