import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationsHeader } from "./page";

describe("NotificationsHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<NotificationsHeader />);

    expect(html).toContain("通知");
    expect(html).toContain("いいね・コメントなどのお知らせ");
  });
});
