import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { MISSING_CAST, MISSING_GUEST, MISSING_USER, ProfileName, profileDisplayName, profileInitial } from "./profile-name";

const profile = (overrides: Partial<ProfileSummaryView> = {}): ProfileSummaryView => ({
  profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false, role: "cast", industry: "", ...overrides,
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

  it("names a missing profile without a link or a lock", () => {
    const html = renderToStaticMarkup(<ProfileName profile={null} link />);

    expect(html).toContain("（無効なユーザー）");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("鍵付き");
  });

  it("names a missing profile by the given role", () => {
    expect(renderToStaticMarkup(<ProfileName profile={null} missing={MISSING_CAST} />)).toContain("（無効なキャスト）");
    expect(renderToStaticMarkup(<ProfileName profile={null} missing={MISSING_GUEST} />)).toContain("（無効なゲスト）");
  });

  it("names a summary without a display name or a username by the given role", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile({ displayName: "", username: "" })} missing={MISSING_GUEST} />)).toContain("（無効なゲスト）");
  });
});

describe("profileDisplayName", () => {
  it("prefers the display name", () => {
    expect(profileDisplayName(profile())).toBe("りん");
  });

  it("falls back to the handle, then to the missing label", () => {
    expect(profileDisplayName(profile({ displayName: "" }))).toBe("@rin");
    expect(profileDisplayName(profile({ displayName: "", username: "" }))).toBe(MISSING_USER);
    expect(profileDisplayName(null)).toBe("（無効なユーザー）");
  });

  it("uses the given role label in place of the default", () => {
    expect(profileDisplayName(null, MISSING_CAST)).toBe("（無効なキャスト）");
    expect(profileDisplayName(null, MISSING_GUEST)).toBe("（無効なゲスト）");
    expect(profileDisplayName(profile({ displayName: "", username: "" }), MISSING_CAST)).toBe("（無効なキャスト）");
  });
});

describe("profileInitial", () => {
  it("takes the first character of the name without the at sign", () => {
    expect(profileInitial(profile())).toBe("り");
    expect(profileInitial(profile({ displayName: "" }))).toBe("r");
  });

  it("is a question mark for a missing profile whatever the role label is", () => {
    expect(profileInitial(null)).toBe("?");
    expect(profileInitial(null, MISSING_CAST)).toBe("?");
  });
});
