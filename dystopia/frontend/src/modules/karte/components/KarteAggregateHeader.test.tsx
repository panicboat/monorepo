import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KarteAggregateHeader } from "./KarteAggregateHeader";

describe("KarteAggregateHeader", () => {
  it("shows the average to one decimal with how many casts and kartes it comes from", () => {
    const html = renderToStaticMarkup(<KarteAggregateHeader reliability={{ averageRating: 3.75, raterCount: 8, karteCount: 12 }} />);

    expect(html).toContain("3.8 / 5.0");
    expect(html).toContain("8人が評価");
    expect(html).toContain("12件の完了済みカルテ");
  });

  it("says unrated when no karte is closed", () => {
    const html = renderToStaticMarkup(<KarteAggregateHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />);

    expect(html).toContain("未評価");
  });
});
