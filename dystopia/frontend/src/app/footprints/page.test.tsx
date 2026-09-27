import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FootprintsHeader } from "./page";

describe("FootprintsHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<FootprintsHeader />);

    expect(html).toContain("足跡");
    expect(html).toContain("プロフィールを見に来た人の一覧");
  });
});
