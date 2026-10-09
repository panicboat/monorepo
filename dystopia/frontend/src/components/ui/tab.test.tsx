import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabs } from "./tab";

const items = [
  { id: "all", label: "全国" },
  { id: "following", label: "フォロー中" },
];

function classesOf(html: string, role: string): string[][] {
  const pattern = new RegExp(`<[a-z]+[^>]*role="${role}"[^>]*>`, "g");
  return (html.match(pattern) ?? []).map((tag) => (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/));
}

describe("Tabs", () => {
  const html = renderToStaticMarkup(<Tabs items={items} value="all" onValueChange={() => {}} />);

  it("scrolls horizontally when the tabs exceed the available width", () => {
    const [tablist] = classesOf(html, "tablist");

    expect(tablist).toContain("overflow-x-auto");
  });

  it("keeps every tab label on one line at its natural width", () => {
    const tabs = classesOf(html, "tab");

    expect(tabs).toHaveLength(items.length);
    for (const tab of tabs) {
      expect(tab).toContain("shrink-0");
      expect(tab).toContain("whitespace-nowrap");
    }
  });
});
