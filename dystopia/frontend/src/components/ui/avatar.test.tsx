import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("wraps itself in a link to href when href is given", () => {
    const html = renderToStaticMarkup(<Avatar fallback="T" href="/u/test_taro" />);

    expect(html).toMatch(/<a[^>]*href="\/u\/test_taro"/);
  });

  it("renders without a link when href is not given", () => {
    const html = renderToStaticMarkup(<Avatar fallback="T" />);

    expect(html).not.toContain("<a ");
  });
});
