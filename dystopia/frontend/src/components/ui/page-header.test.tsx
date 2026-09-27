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
});
