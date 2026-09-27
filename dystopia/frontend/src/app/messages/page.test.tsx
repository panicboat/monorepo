import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagesHeader } from "./page";

describe("MessagesHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<MessagesHeader />);

    expect(html).toContain("メッセージ");
    expect(html).toContain("個別のダイレクトメッセージ");
  });
});
