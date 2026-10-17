import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMocks = vi.hoisted(() => ({ role: "guest" as "cast" | "guest" | null, isHydrated: true }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string | null; isHydrated: boolean }) => unknown) =>
    selector({ role: authMocks.role, isHydrated: authMocks.isHydrated }),
  selectRole: (state: { role: string | null }) => state.role,
  selectIsHydrated: (state: { isHydrated: boolean }) => state.isHydrated,
}));
vi.mock("@/modules/karte/hooks/useMyKarte", () => ({
  useMyKarte: () => ({ entries: [], kartes: [], hasMore: false, loading: false, loadMore: vi.fn(), refresh: vi.fn() }),
}));

const { default: MyKartePage, MyKarteHeader } = await import("./page");

describe("MyKarteHeader", () => {
  it("renders a description of what this page is", () => {
    const html = renderToStaticMarkup(<MyKarteHeader />);

    expect(html).toContain("自分のカルテ");
    expect(html).toContain("ゲストについて書いたレビューの管理・共有");
  });
});

describe("MyKartePage", () => {
  it("waits for the auth store before deciding what to show", () => {
    authMocks.role = null;
    authMocks.isHydrated = false;

    const html = renderToStaticMarkup(<MyKartePage />);
    authMocks.isHydrated = true;

    expect(html).toContain("読み込み中…");
    expect(html).not.toContain("キャストだけが使えます");
  });

  it("tells a guest that karte is for casts", () => {
    authMocks.role = "guest";

    expect(renderToStaticMarkup(<MyKartePage />)).toContain("カルテはキャストだけが使えます");
  });

  it("shows the page to a cast", () => {
    authMocks.role = "cast";

    const html = renderToStaticMarkup(<MyKartePage />);

    expect(html).toContain("自分のカルテ");
    expect(html).not.toContain("キャストだけが使えます");
  });
});
