import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsHeader } from "./page";

describe("SettingsHeader", () => {
  it("renders a description of what this page is", () => {
    const html = renderToStaticMarkup(<SettingsHeader />);

    expect(html).toContain("設定");
    expect(html).toContain("プロフィール・外観の設定");
  });
});
