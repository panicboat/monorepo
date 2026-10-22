import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewSummaryHeader } from "./ReviewSummaryHeader";

describe("ReviewSummaryHeader", () => {
  it("shows the average, the raters and the rated reviews", () => {
    const html = renderToStaticMarkup(<ReviewSummaryHeader summary={{ averageRating: 3.75, raterCount: 2, reviewCount: 3 }} />);

    expect(html).toContain("3.8");
    expect(html).toContain("5段階中 4.0");
    expect(html).toContain("利用の満足度（参考評価）");
    expect(html).toContain("2人が評価 · 3件の評価済みクチコミ");
  });

  it("shows a dash and unrated before any rated review", () => {
    const html = renderToStaticMarkup(<ReviewSummaryHeader summary={{ averageRating: null, raterCount: 0, reviewCount: 0 }} />);

    expect(html).toContain("—");
    expect(html).toContain("未評価");
    expect(html).toContain("0人が評価 · 0件の評価済みクチコミ");
  });
});
