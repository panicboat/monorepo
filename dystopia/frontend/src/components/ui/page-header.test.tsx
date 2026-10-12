import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title and description", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="通知" description="いいね・コメントなどのお知らせ" />
    );

    expect(html).toContain("通知");
    expect(html).toContain("いいね・コメントなどのお知らせ");
  });

  it("sets the title at 21px in bold over a small description", () => {
    const html = renderToStaticMarkup(<PageHeader title="通知" description="お知らせ" />);

    expect(/<h1 class="([^"]*)"/.exec(html)?.[1].split(/\s+/)).toEqual(expect.arrayContaining(["text-[1.3125rem]", "font-bold"]));
    expect(/<p class="([^"]*)"/.exec(html)?.[1].split(/\s+/)).toEqual(expect.arrayContaining(["text-xs", "text-text-secondary"]));
  });
});
