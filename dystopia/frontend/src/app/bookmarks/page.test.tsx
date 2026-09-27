import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookmarksHeader } from "./page";

describe("BookmarksHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<BookmarksHeader />);

    expect(html).toContain("ブックマーク");
    expect(html).toContain("保存した投稿の一覧");
  });
});
