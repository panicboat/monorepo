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
  it("shows the author's schedule in the shared summary with the author's industry icon", () => {
    const html = render();

    expect(html).toContain("予定");
    expect(html).toContain("20:00〜02:00");
    expect(html).toContain("10/23（金）");
    expect(html).toMatch(/<span role="img" aria-label="デリヘル"[^>]*>🚗<\/span>/);
  });

  it("links the whole card to the author's schedule tab", () => {
    expect(render()).toMatch(/<a[^>]*href="\/u\/rin\?tab=schedule"[^>]*>(?:(?!<\/a>).)*予定(?:(?!<\/a>).)*<\/a>/s);
  });

  it("renders no link when the author has no username or there is no author", () => {
    expect(render({ author: { ...author, username: "" } })).not.toContain("<a");
    expect(render({ author: null })).not.toContain("<a");
    expect(render({ author: null })).toContain("20:00〜02:00");
  });
});
