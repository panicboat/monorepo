import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { EntryCard } from "./entry-card";

const profile: ProfileSummaryView = {
  profileId: "a1",
  username: "yuna",
  displayName: "ゆな",
  avatarUrl: "",
  isPrivate: false,
  role: null,
  industry: "",
};

const avatarInitial = (html: string) => html.match(/rounded-full[^>]*>(?:<img[^>]*>)?<span[^>]*>([^<]*)<\/span>/)?.[1];

const profileLinks = (html: string) => html.match(/<a[^>]*href="\/u\/yuna"/g)?.length ?? 0;

describe("EntryCard", () => {
  it("links the avatar and the name to the profile and shows the meta beside the name", () => {
    const html = renderToStaticMarkup(<EntryCard profile={profile} meta="3分前">本文</EntryCard>);

    expect(profileLinks(html)).toBe(2);
    expect(html).toContain("3分前");
    expect(html).toContain("本文");
  });

  it("makes the inner card a link of its own when given an href", () => {
    const html = renderToStaticMarkup(
      <EntryCard profile={profile} meta="" href="/messages/t1">
        本文
      </EntryCard>
    );

    expect(html.match(/<a /g)?.length).toBe(3);
    expect(html).toMatch(/<a[^>]*href="\/messages\/t1"[^>]*>本文<\/a>/);
  });

  it("makes the inner card a button without links inside when given onClick", () => {
    const html = renderToStaticMarkup(
      <EntryCard profile={profile} meta="" onClick={() => {}}>
        本文
      </EntryCard>
    );

    expect(html).toMatch(/<button[^>]*>本文<\/button>/);
    expect(profileLinks(html)).toBe(2);
  });

  it("keeps the inner card static without an href or onClick", () => {
    const html = renderToStaticMarkup(<EntryCard profile={profile} meta="">本文</EntryCard>);

    expect(html).not.toContain("<button");
    expect(html.match(/<a /g)?.length).toBe(2);
  });

  it("marks an unread entry", () => {
    const unread = renderToStaticMarkup(<EntryCard profile={profile} meta="" unread>本文</EntryCard>);
    const read = renderToStaticMarkup(<EntryCard profile={profile} meta="">本文</EntryCard>);

    expect(unread).toContain('aria-label="未読"');
    expect(read).not.toContain('aria-label="未読"');
  });

  it("shows a deleted profile without profile links", () => {
    const html = renderToStaticMarkup(<EntryCard profile={null} meta="">本文</EntryCard>);

    expect(html).toContain("（無効なユーザー）");
    expect(html).not.toContain("<a ");
  });

  it("uses a question mark as the avatar initial for a deleted profile and the first character otherwise", () => {
    expect(avatarInitial(renderToStaticMarkup(<EntryCard profile={null} meta="">本文</EntryCard>))).toBe("?");
    expect(avatarInitial(renderToStaticMarkup(<EntryCard profile={profile} meta="">本文</EntryCard>))).toBe("ゆ");
  });
});
