import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileHeader } from "./ProfileHeader";
import type { ProfileView } from "@/modules/profile/types";

const profile: ProfileView = {
  accountId: "demo",
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
});
