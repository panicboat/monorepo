import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/footprints", () => ({
  useFootprints: () => ({ footprints: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
  useFootprintsUnreadCount: () => ({ count: 0, refresh: vi.fn() }),
  markFootprintsRead: () => Promise.resolve(),
}));

const { default: FootprintsPage } = await import("./page");

describe("FootprintsPage", () => {
  it("explains what the list shows", () => {
    const html = renderToStaticMarkup(<FootprintsPage />);

    expect(html).toContain("最近の訪問を表示しています。足跡を残すかどうかは");
    expect(html).toMatch(/<a[^>]*href="\/settings\/notifications"[^>]*>通知設定<\/a>で切り替えられます。/);
  });
});
