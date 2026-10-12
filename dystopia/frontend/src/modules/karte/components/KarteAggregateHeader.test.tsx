import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KarteAggregateHeader } from "./KarteAggregateHeader";

describe("KarteAggregateHeader", () => {
  it("shows the equal-account average with its rater and rated-chart counts", () => {
    const html = renderToStaticMarkup(<KarteAggregateHeader aggregate={{ count: 6, avgRating: 3, authorCount: 2, ratedCount: 4 }} />);
    expect(html).toContain("3.0"); expect(html).toContain("2人"); expect(html).toContain("4件"); expect(html).toContain("6件");
  });
  it("distinguishes an unrated population from an empty one", () => {
    const unrated = renderToStaticMarkup(<KarteAggregateHeader aggregate={{ count: 2, avgRating: null, authorCount: 0, ratedCount: 0 }} />);
    const empty = renderToStaticMarkup(<KarteAggregateHeader aggregate={{ count: 0, avgRating: null, authorCount: 0, ratedCount: 0 }} />);
    expect(unrated).toContain("未評価"); expect(unrated).not.toContain("0.0"); expect(unrated).not.toContain("カルテはまだありません"); expect(empty).toContain("カルテはまだありません");
  });
});
