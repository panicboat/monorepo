import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MyKarteHeader } from "./page";

describe("MyKarteHeader", () => {
  it("renders a description of what this page is", () => {
    const html = renderToStaticMarkup(<MyKarteHeader />);

    expect(html).toContain("自分のカルテ");
    expect(html).toContain("ゲストについて書いたレビューの管理・共有");
  });
});
