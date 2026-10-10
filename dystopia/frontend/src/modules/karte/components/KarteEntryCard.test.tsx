import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useDeleteKarte", () => ({
  useDeleteKarte: () => ({ remove: vi.fn(), loading: false }),
}));
vi.mock("../hooks/useReportKarte", () => ({
  useReportKarte: () => ({ report: vi.fn(), loading: false }),
}));

const { KarteEntryCard } = await import("./KarteEntryCard");

const baseEntry = {
  id: "e-1",
  authorProfileId: "author-1",
  targetProfileId: "target-1",
  isMine: false,
  authorUsername: "cast_taro",
  authorAvatarUrl: "",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  rating: 4,
  body: "memo",
  flagged: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("KarteEntryCard recent mode", () => {
  it("shows both author and target identities", () => {
    const html = renderToStaticMarkup(
      <KarteEntryCard entry={baseEntry} mode="recent" />,
    );

    expect(html).toContain("cast_taro");
    expect(html).toContain("guest_hanako");
  });

  it("links both the author and the target to their profiles", () => {
    const html = renderToStaticMarkup(
      <KarteEntryCard entry={baseEntry} mode="recent" />,
    );

    expect(html).toContain('href="/u/cast_taro"');
    expect(html).toContain('href="/u/guest_hanako"');
  });
});

describe("KarteEntryCard identity link", () => {
  it("links the target of an entry in the own list to the target's profile", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={baseEntry} mode="my" />);

    expect(html).toContain('href="/u/guest_hanako"');
  });

  it("links the author of an entry about a guest to the author's profile", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={baseEntry} mode="target" />);

    expect(html).toContain('href="/u/cast_taro"');
    expect(html).not.toContain('href="/u/guest_hanako"');
  });
});

describe("KarteEntryCard ownership", () => {
  it("offers delete and no report for an entry the server marks as mine", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={{ ...baseEntry, isMine: true }} mode="my" />);

    expect(html).toContain("削除");
    expect(html).not.toContain("報告");
  });

  it("offers report and no delete for an entry that is not mine", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={{ ...baseEntry, isMine: false }} mode="target" />);

    expect(html).toContain("報告");
    expect(html).not.toContain("削除");
  });

  it("decides by the server flag, not by comparing ids on the client", () => {
    const html = renderToStaticMarkup(
      <KarteEntryCard entry={{ ...baseEntry, authorProfileId: "another-persona-of-mine", isMine: true }} mode="recent" />
    );

    expect(html).toContain("削除");
  });
});

describe("KarteEntryCard editing", () => {
  it("offers edit for an entry the server marks as mine and not for another cast's entry", () => {
    const mine = renderToStaticMarkup(<KarteEntryCard entry={{ ...baseEntry, isMine: true }} mode="my" />);
    const theirs = renderToStaticMarkup(<KarteEntryCard entry={{ ...baseEntry, isMine: false }} mode="target" />);

    expect(mine).toContain(">編集<");
    expect(theirs).not.toContain(">編集<");
  });

  it("marks an entry whose content was changed after it was written", () => {
    const edited = { ...baseEntry, createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:05:00.000Z" };
    const untouched = { ...edited, updatedAt: edited.createdAt };

    expect(renderToStaticMarkup(<KarteEntryCard entry={edited} mode="recent" />)).toContain("編集済み");
    expect(renderToStaticMarkup(<KarteEntryCard entry={untouched} mode="recent" />)).not.toContain("編集済み");
  });
});
