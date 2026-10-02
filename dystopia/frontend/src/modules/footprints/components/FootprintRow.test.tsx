import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FootprintRow } from "./FootprintRow";
import type { FootprintView } from "@/modules/footprints/types";

const footprint: FootprintView = {
  visitor: { accountId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: null },
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
      <FootprintRow footprint={{ ...footprint, visitor: { ...footprint.visitor, username: "" } }} />
    );

    expect(html).not.toContain("<a ");
  });
});
