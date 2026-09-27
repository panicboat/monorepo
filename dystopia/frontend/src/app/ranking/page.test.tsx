import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RankingHeader } from "./page";

describe("RankingHeader", () => {
  it("renders a description of what the ranking is ranked by", () => {
    const html = renderToStaticMarkup(<RankingHeader />);

    expect(html).toContain("🏆 ランキング");
    expect(html).toContain("期間別の人気投稿ランキング");
  });
});
