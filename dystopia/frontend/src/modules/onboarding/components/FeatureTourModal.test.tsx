import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeatureTourList } from "./FeatureTourModal";

describe("FeatureTourList", () => {
  it("lists every nav feature with a description, including the cast-only karte item", () => {
    const html = renderToStaticMarkup(<FeatureTourList />);

    expect(html).toContain("ホーム");
    expect(html).toContain("フォロー中のアカウントの投稿が並ぶタイムライン");
    expect(html).toContain("カルテ");
    expect(html).toContain("ゲストについて書いたレビューの管理・共有");
  });
});
