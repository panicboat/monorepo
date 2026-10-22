import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { PostScheduleCard } from "./PostScheduleCard";

const schedule = { workDate: "2026-10-23", startTime: "20:00", endTime: "02:00" };
const author: ProfileSummaryView = {
  profileId: "author-1",
  username: "rin",
  displayName: "りん",
  avatarUrl: "",
  isPrivate: false,
  role: "cast",
  industry: "デリヘル",
};

const render = (props: { author?: ProfileSummaryView | null; schedule?: typeof schedule } = {}) =>
  renderToStaticMarkup(
    <PostScheduleCard schedule={props.schedule ?? schedule} author={props.author === undefined ? author : props.author} />
  );

describe("PostScheduleCard", () => {
  it("shows the heading and the date with the start and end", () => {
    const html = render();

    expect(html).toContain("出勤");
    expect(html).toContain("10/23（金） 20:00〜02:00");
  });

  it("marks a schedule that runs past midnight with a muted next-day label after the time", () => {
    const html = render();

    expect(html).toMatch(/20:00〜02:00<span class="[^"]*text-text-muted[^"]*">翌日<\/span>/);
  });

  it("marks a schedule that starts before 05:00 as the next day", () => {
    const html = render({ schedule: { workDate: "2026-10-23", startTime: "01:00", endTime: "05:00" } });

    expect(html).toContain("01:00〜05:00");
    expect(html).toContain("翌日");
  });

  it("shows no next-day label for a schedule that ends on its work date", () => {
    const html = render({ schedule: { workDate: "2026-10-23", startTime: "10:00", endTime: "18:00" } });

    expect(html).toContain("10/23（金） 10:00〜18:00");
    expect(html).not.toContain("翌日");
  });

  it("uses the frame of the review card", () => {
    expect(render()).toContain("rounded-xl border border-border bg-surface p-3");
  });

  it("links the whole card to the author's profile", () => {
    const html = render();

    expect(html).toMatch(/<a[^>]*href="\/u\/rin"[^>]*>(?:(?!<\/a>).)*出勤(?:(?!<\/a>).)*20:00〜02:00(?:(?!<\/a>).)*<\/a>/s);
  });

  it("renders no link when the author has no username", () => {
    const html = render({ author: { ...author, username: "" } });

    expect(html).not.toContain("<a");
    expect(html).toContain("10/23（金） 20:00〜02:00");
  });

  it("renders no link when there is no author", () => {
    expect(render({ author: null })).not.toContain("<a");
  });

  it("leads the date with the industry icon, named by the industry", () => {
    const html = render();

    expect(html).toMatch(/<span role="img" aria-label="デリヘル"[^>]*>🚗<\/span>/);
    expect(html.indexOf("🚗")).toBeLessThan(html.indexOf("10/23（金）"));
  });

  it("shows no icon when the industry is unset or not in the list", () => {
    for (const industry of ["", "未知の業種"]) {
      const html = render({ author: { ...author, industry } });

      expect(html).not.toContain('role="img"');
      expect(html).toContain("10/23（金） 20:00〜02:00");
    }
  });
});
