import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { ProfileName } from "./profile-name";

const profile = (overrides: Partial<ProfileSummaryView> = {}): ProfileSummaryView => ({
  profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false, role: "cast", ...overrides,
});

describe("ProfileName", () => {
  it("shows the display name and links to the profile", () => {
    const html = renderToStaticMarkup(<ProfileName profile={profile()} link />);

    expect(html).toContain('href="/u/rin"');
    expect(html).toContain("りん");
    expect(html).not.toContain("鍵付き");
  });

  it("adds the lock mark for a private profile", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile({ isPrivate: true })} />)).toContain('aria-label="鍵付き"');
  });

  it("falls back to the handle when the display name is empty", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile({ displayName: "" })} />)).toContain("@rin");
  });

  it("does not link without the link flag or without a username", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile()} />)).not.toContain("href=");
    expect(renderToStaticMarkup(<ProfileName profile={profile({ username: "" })} link />)).not.toContain("href=");
  });

  it("names a deleted profile without a link or a lock", () => {
    const html = renderToStaticMarkup(<ProfileName profile={null} link />);

    expect(html).toContain("削除したプロフィール");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("鍵付き");
  });
});
