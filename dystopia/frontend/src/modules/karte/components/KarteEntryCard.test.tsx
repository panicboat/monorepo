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
