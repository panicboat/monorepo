import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SendRestrictionNotice } from "./SendRestrictionNotice";

describe("SendRestrictionNotice", () => {
  it("explains that a follow is required and links to the counterpart's profile", () => {
    const html = renderToStaticMarkup(<SendRestrictionNotice restriction="follow_required" counterpartUsername="yuna" />);

    expect(html).toContain("相手をフォローするとメッセージを送れます");
    expect(html).toContain('href="/u/yuna"');
  });

  it("explains a block without offering a way to the profile", () => {
    const html = renderToStaticMarkup(<SendRestrictionNotice restriction="blocked" counterpartUsername="yuna" />);

    expect(html).toContain("この相手とはメッセージを送受信できません");
    expect(html).not.toContain("<a ");
  });

  it("explains that the counterpart's profile is unavailable", () => {
    const html = renderToStaticMarkup(<SendRestrictionNotice restriction="counterpart_unavailable" />);

    expect(html).toContain("相手のプロフィールが利用できないため、メッセージを送れません");
    expect(html).not.toContain("<a ");
  });
});
