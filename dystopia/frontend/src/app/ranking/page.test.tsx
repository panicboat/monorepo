import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RankingHeader } from "./page";

describe("RankingHeader", () => {
  it("renders a description of what the ranking is ranked by", () => {
    const html = renderToStaticMarkup(<RankingHeader />);

    expect(html).toContain("🏆 ランキング");
    expect(html).toContain("いいねが多い投稿を期間別に並べたランキングです");
  });
});
