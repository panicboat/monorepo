import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MyReviewsHeader } from "./page";

describe("MyReviewsHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<MyReviewsHeader />);

    expect(html).toContain("レビュー");
    expect(html).toContain("キャストについて書いたレビューの一覧");
  });
});
