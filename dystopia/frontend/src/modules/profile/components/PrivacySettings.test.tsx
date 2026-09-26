import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacySettings } from "./PrivacySettings";
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
  areas: [],
  role: 1,
};

describe("PrivacySettings", () => {
  it("renders a link to the blocked accounts list", () => {
    const html = renderToStaticMarkup(
      <PrivacySettings profile={profile} save={async () => {}} />
    );

    expect(html).toContain('href="/settings/blocks"');
  });
});
