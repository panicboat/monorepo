import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IdentityLink } from "./identity-link";

describe("IdentityLink", () => {
  it("links the avatar and the username to the profile page", () => {
    const html = renderToStaticMarkup(<IdentityLink username="cast_taro" avatarUrl="" />);

    expect(html).toMatch(/<a[^>]*href="\/u\/cast_taro"[^>]*>.*cast_taro.*<\/a>/);
  });

  it("escapes the username in the profile path", () => {
    const html = renderToStaticMarkup(<IdentityLink username="a/b" avatarUrl="" />);

    expect(html).toContain('href="/u/a%2Fb"');
  });

  it("shows a withdrawn profile without a link", () => {
    const html = renderToStaticMarkup(<IdentityLink username="" avatarUrl="" />);

    expect(html).toContain("(退会済)");
    expect(html).not.toContain("<a ");
  });
});
