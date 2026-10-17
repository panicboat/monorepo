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

const authMocks = vi.hoisted(() => ({ role: null as "cast" | "guest" | null }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign(
    (selector: (state: { role: string | null }) => unknown) => selector({ role: authMocks.role }),
    { subscribe: () => () => {}, getState: () => ({}) },
  ),
  selectRole: (state: { role: string | null }) => state.role,
}));

const karteMocks = vi.hoisted(() => ({ useRecentKarte: vi.fn() }));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: karteMocks.useRecentKarte }));

const reviewMocks = vi.hoisted(() => ({ useRecentReviews: vi.fn() }));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({ useRecentReviews: reviewMocks.useRecentReviews }));

const { default: HomePage } = await import("./page");

const emptyList = { reviews: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };
const emptyKarte = { kartes: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };

describe("HomePage tabs", () => {
  it("shows the karte tab to a cast", () => {
    authMocks.role = "cast";
    karteMocks.useRecentKarte.mockReturnValue(emptyKarte);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("カルテ");
    expect(html).toContain("クチコミ");
  });

  it("hides the karte tab from a guest but keeps the review tab", () => {
    authMocks.role = "guest";
    karteMocks.useRecentKarte.mockReturnValue(emptyKarte);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).not.toContain("カルテ");
    expect(html).toContain("クチコミ");
  });
});
