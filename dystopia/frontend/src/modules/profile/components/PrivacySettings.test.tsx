import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacySettings } from "./PrivacySettings";
import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";
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
  role: 1,
  disabled: false,
};

describe("PrivacySettings", () => {
  it("renders a link to the blocked accounts list", () => {
    const html = renderToStaticMarkup(
      <PrivacySettings profile={profile} save={async () => {}} />
    );

    expect(html).toContain('href="/settings/blocks"');
  });

  it("names the lock as a setting of the profile in use", () => {
    const html = renderToStaticMarkup(<PrivacySettings profile={profile} save={async () => {}} />);

    expect(html).toContain("プロフィールに鍵をかける");
    expect(html).toContain("@yuna の設定です");
    expect(html).not.toContain("鍵アカウント");
  });

  it("tells an account with several profiles that the lock is set per profile", () => {
    const accountProfiles = (profiles: ProfileView[]) => ({
      profiles,
      switchProfile: () => {},
      refresh: async () => {},
      append: async () => {},
    });
    const withProfiles = (profiles: ProfileView[]) =>
      renderToStaticMarkup(
        <AccountProfilesProvider value={accountProfiles(profiles)}>
          <PrivacySettings profile={profile} save={async () => {}} />
        </AccountProfilesProvider>
      );

    expect(withProfiles([profile, { ...profile, id: "second", username: "yuna_osaka" }])).toContain("鍵はプロフィールごとの設定です");
    expect(withProfiles([profile])).not.toContain("鍵はプロフィールごとの設定です");
  });
});
