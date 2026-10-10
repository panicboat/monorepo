import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileHeader } from "./ProfileHeader";
import type { ProfileView } from "@/modules/profile/types";

const profile: ProfileView = {
  id: "demo",
  username: "yuna",
  displayName: "ゆな",
  bio: "",
  avatarMediaId: "",
  avatarUrl: "",
  coverMediaId: "",
  coverUrl: "",
  website: "",
  snsLinks: { x: "", instagram: "", tiktok: "", bluesky: "", line: "", cityheaven: "" },
  prefecture: "東京都",
  isPrivate: false,
  registeredAt: "",
  age: 23,
  bodyStats: { heightCm: 158, bust: 88, waist: 58, hip: 86, cup: "D" },
  industry: "",
  role: 2,
  disabled: false,
};

describe("ProfileHeader", () => {
  it("labels a cast profile as キャスト, not セラピスト", () => {
    const html = renderToStaticMarkup(<ProfileHeader profile={profile} role="cast" />);

    expect(html).toContain("キャスト");
    expect(html).not.toContain("セラピスト");
  });

  it("labels a guest profile as ゲスト, not ユーザー", () => {
    const html = renderToStaticMarkup(<ProfileHeader profile={profile} role="guest" />);

    expect(html).toContain("ゲスト");
    expect(html).not.toContain("ユーザー");
  });

  it("shows the height of a cast as its own item apart from the three sizes", () => {
    const html = renderToStaticMarkup(<ProfileHeader profile={profile} role="cast" />);

    expect(html).toContain("<span>158cm</span>");
    expect(html).toContain("<span>B88(D) W58 H86</span>");
  });

  it("places the given actions beside the avatar, ahead of the display name", () => {
    const html = renderToStaticMarkup(
      <ProfileHeader profile={profile} role="cast" actions={<button type="button">follow-action</button>} />
    );

    expect(html).toContain("follow-action");
    expect(html.indexOf("follow-action")).toBeLessThan(html.indexOf("<h1"));
  });

  it("marks a locked profile next to its display name", () => {
    const locked = renderToStaticMarkup(<ProfileHeader profile={{ ...profile, isPrivate: true }} role="cast" />);
    const open = renderToStaticMarkup(<ProfileHeader profile={profile} role="cast" />);

    expect(locked).toMatch(/<\/h1><span role="img" aria-label="鍵付き"/);
    expect(open).not.toContain('aria-label="鍵付き"');
  });

  it("shows the month of registration beside a calendar icon", () => {
    const html = renderToStaticMarkup(
      <ProfileHeader profile={{ ...profile, registeredAt: "2026-03-15T00:00:00Z" }} role="guest" />
    );

    expect(html).toMatch(/lucide-calendar-days[^>]*>.*?<\/svg>2026年3月に登録/);
  });

  it("shows the industry of a cast as an icon named after the industry", () => {
    const html = renderToStaticMarkup(<ProfileHeader profile={{ ...profile, industry: "ソープ" }} role="cast" />);

    expect(html).toMatch(/<span role="img" aria-label="ソープ" title="ソープ">🛁<\/span>/);
    expect(html).not.toContain(">ソープ<");
  });

  it("shows the location as plain text, so the pin stands for an industry alone", () => {
    const html = renderToStaticMarkup(<ProfileHeader profile={{ ...profile, industry: "ピンサロ" }} role="cast" />);

    expect(html).toContain("<span>東京都</span>");
    expect(html.match(/📍/g)).toHaveLength(1);
  });

  it("shows the industry as text when it has no icon", () => {
    const html = renderToStaticMarkup(<ProfileHeader profile={{ ...profile, industry: "その他" }} role="cast" />);

    expect(html).toContain("<span>その他</span>");
  });
});
