import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KarteReliabilityHeader } from "./KarteReliabilityHeader";

describe("KarteReliabilityHeader", () => {
  it("shows the average, the raters and the closed kartes", () => {
    const html = renderToStaticMarkup(<KarteReliabilityHeader reliability={{ averageRating: 3.75, raterCount: 2, karteCount: 3 }} />);

    expect(html).toContain("3.8");
    expect(html).toContain("5段階中 4.0");
    expect(html).toContain("予約・接客の信頼性（参考評価）");
    expect(html).toContain("2人が評価 · 3件の完了済みカルテ");
  });

  it("shows a dash and unrated before any closed karte", () => {
    const html = renderToStaticMarkup(<KarteReliabilityHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />);

    expect(html).toContain("—");
    expect(html).toContain("未評価");
    expect(html).toContain("0人が評価 · 0件の完了済みカルテ");
  });
});
