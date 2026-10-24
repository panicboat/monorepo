import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FootprintRow } from "./FootprintRow";
import type { FootprintView } from "@/modules/footprints/types";

const footprint: FootprintView = {
  visitor: { profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: null, industry: "" },
  lastVisitedAt: new Date().toISOString(),
  isUnread: false,
  visitCount: 1,
};

describe("FootprintRow", () => {
  it("links the visitor's avatar and name to their profile as two separate links", () => {
    const html = renderToStaticMarkup(<FootprintRow footprint={footprint} />);
    const matches = html.match(/<a[^>]*href="\/u\/yuna"/g) ?? [];

    expect(matches.length).toBe(2);
  });

  it("does not link when the visitor has no username", () => {
    const html = renderToStaticMarkup(
      <FootprintRow footprint={{ ...footprint, visitor: { ...footprint.visitor!, username: "" } }} />
    );

    expect(html).not.toContain("<a ");
  });

  it("marks only a visitor whose profile is locked", () => {
    const locked = renderToStaticMarkup(
      <FootprintRow footprint={{ ...footprint, visitor: { ...footprint.visitor!, isPrivate: true } }} />
    );
    const open = renderToStaticMarkup(<FootprintRow footprint={footprint} />);

    expect(locked).toContain('aria-label="鍵付き"');
    expect(open).not.toContain('aria-label="鍵付き"');
  });

  it("shows a deleted-profile label and no link when the visitor is gone", () => {
    const html = renderToStaticMarkup(<FootprintRow footprint={{ ...footprint, visitor: null }} />);

    expect(html).toContain("（無効なユーザー）");
    expect(html).not.toContain("<a ");
  });

  it("says the visitor viewed the profile and counts repeat visits", () => {
    const once = renderToStaticMarkup(<FootprintRow footprint={footprint} />);
    const repeated = renderToStaticMarkup(<FootprintRow footprint={{ ...footprint, visitCount: 3 }} />);

    expect(once).toContain("あなたのプロフィールを見ました");
    expect(once).not.toContain("回訪問");
    expect(repeated).toContain("3回訪問");
  });

  it("marks only an unread footprint", () => {
    const unread = renderToStaticMarkup(<FootprintRow footprint={{ ...footprint, isUnread: true }} />);
    const read = renderToStaticMarkup(<FootprintRow footprint={footprint} />);

    expect(unread).toContain('aria-label="未読"');
    expect(read).not.toContain('aria-label="未読"');
  });
});
