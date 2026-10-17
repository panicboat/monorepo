import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMocks = vi.hoisted(() => ({ role: "guest" as "cast" | "guest" | null, isHydrated: true }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string | null; isHydrated: boolean }) => unknown) =>
    selector({ role: authMocks.role, isHydrated: authMocks.isHydrated }),
  selectRole: (state: { role: string | null }) => state.role,
  selectIsHydrated: (state: { isHydrated: boolean }) => state.isHydrated,
}));
vi.mock("@/modules/review/hooks/useMyReviews", () => ({
  useMyReviews: () => ({ reviews: [], counts: { total: 3, open: 2, closed: 1 }, hasMore: false, loading: false, loadMore: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/review/components/ReviewList", () => ({
  ReviewList: ({ variant, empty }: { variant: string; empty: string }) => <div>list:{variant}:{empty}</div>,
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({ ComposeToSheet: () => null }));

const { default: MyReviewsPage, MyReviewsHeader } = await import("./page");

describe("MyReviewsHeader", () => {
  it("renders a description of what this page is", () => {
    const html = renderToStaticMarkup(<MyReviewsHeader />);

    expect(html).toContain("自分のクチコミ");
    expect(html).toContain("自分が書いたクチコミの一覧。ホームの「クチコミ」は全員の新着です。");
  });
});

describe("MyReviewsPage", () => {
  it("waits for the auth store before deciding what to show", () => {
    authMocks.role = null;
    authMocks.isHydrated = false;

    const html = renderToStaticMarkup(<MyReviewsPage />);
    authMocks.isHydrated = true;

    expect(html).toContain("読み込み中…");
    expect(html).not.toContain("ゲストだけが書けます");
  });

  it("tells a cast that review is for guests", () => {
    authMocks.role = "cast";

    expect(renderToStaticMarkup(<MyReviewsPage />)).toContain("クチコミはゲストだけが書けます。");
  });

  it("shows the page to a guest", () => {
    authMocks.role = "guest";

    const html = renderToStaticMarkup(<MyReviewsPage />);

    expect(html).toContain("自分のクチコミ");
    expect(html).not.toContain("ゲストだけが書けます");
    expect(html).toContain("＋ クチコミを作成");
    expect(html).toMatch(/3<\/p><p[^>]*>自分のクチコミ/);
    expect(html).toMatch(/2<\/p><p[^>]*>記録中/);
    expect(html).toMatch(/1<\/p><p[^>]*>完了/);
    expect(html).toContain("list:mine:自分のクチコミはまだありません");
  });
});
