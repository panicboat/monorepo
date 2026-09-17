import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCard } from "./post-card";

const baseProps = {
  author: { name: "テスト太郎", handle: "test_taro" },
  time: "1分前",
  body: "こんにちは",
};

describe("PostCard", () => {
  it("wraps the author name in a link to the profile when authorHref is given", () => {
    const html = renderToStaticMarkup(
      <PostCard {...baseProps} authorHref="/u/test_taro" />
    );

    expect(html).toContain(`<a href="/u/test_taro"`);
    expect(html).toContain("テスト太郎");
  });

  it("renders the author name as plain text when authorHref is not given", () => {
    const html = renderToStaticMarkup(<PostCard {...baseProps} />);

    expect(html).not.toContain("<a ");
  });
});
