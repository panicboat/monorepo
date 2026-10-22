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

const render = (props: { author?: ProfileSummaryView | null } = {}) =>
  renderToStaticMarkup(<PostScheduleCard schedule={schedule} author={props.author === undefined ? author : props.author} />);

describe("PostScheduleCard", () => {
  it("shows the heading and the date with the start and end", () => {
    const html = render();

    expect(html).toContain("出勤");
    expect(html).toContain("10/23（金） 20:00〜02:00");
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
