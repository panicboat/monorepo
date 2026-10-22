import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleSummary } from "./ScheduleSummary";

const render = (props: Partial<Parameters<typeof ScheduleSummary>[0]> = {}) =>
  renderToStaticMarkup(
    <ScheduleSummary workDate="2026-10-23" startTime="20:00" endTime="02:00" industry="デリヘル" {...props} />
  );

describe("ScheduleSummary", () => {
  it("shows the heading, then the work hours in bold, then the date", () => {
    const html = render();

    expect(html).toMatch(/<p class="[^"]*font-bold[^"]*">20:00〜02:00/);
    expect(html.indexOf("予定")).toBeLessThan(html.indexOf("20:00〜02:00"));
    expect(html.indexOf("20:00〜02:00")).toBeLessThan(html.indexOf("10/23（金）"));
  });

  it("adds 翌日 after the hours when they run past midnight or start before 05:00", () => {
    expect(render()).toMatch(/20:00〜02:00<span[^>]*>翌日<\/span>/);
    expect(render({ startTime: "01:00", endTime: "05:00" })).toContain("翌日");
    expect(render({ startTime: "10:00", endTime: "18:00" })).not.toContain("翌日");
  });

  it("leads the date with the industry icon, named by the industry", () => {
    const html = render();

    expect(html).toMatch(/<span role="img" aria-label="デリヘル"[^>]*>🚗<\/span>/);
    expect(html.indexOf("🚗")).toBeLessThan(html.indexOf("10/23（金）"));
  });

  it("shows no icon when the industry is unset or not in the list", () => {
    for (const industry of ["", "未登録の業種"]) {
      const html = render({ industry });
      expect(html).not.toContain('role="img"');
      expect(html).toContain("10/23（金）");
    }
  });

  it("uses the frame of the review card", () => {
    expect(render()).toContain("rounded-xl border border-border bg-surface p-3");
  });

  it("links the whole frame when given a link, and renders no link otherwise", () => {
    expect(render({ href: "/u/rin?tab=schedule" })).toMatch(
      /<a[^>]*href="\/u\/rin\?tab=schedule"[^>]*>(?:(?!<\/a>).)*予定(?:(?!<\/a>).)*20:00〜02:00(?:(?!<\/a>).)*10\/23（金）(?:(?!<\/a>).)*<\/a>/s
    );
    expect(render()).not.toContain("<a");
  });
});
