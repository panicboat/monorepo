import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("shows the given text in the warning or the success tone", () => {
    const warning = renderToStaticMarkup(<StatusBadge tone="warning">記録中</StatusBadge>);
    const success = renderToStaticMarkup(<StatusBadge tone="success">完了</StatusBadge>);

    expect(warning).toContain("記録中");
    expect(warning).toContain("text-warning");
    expect(success).toContain("完了");
    expect(success).toContain("text-success-text");
  });
});
