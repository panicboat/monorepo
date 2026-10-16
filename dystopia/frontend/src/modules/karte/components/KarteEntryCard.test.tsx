import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Karte } from "../types";

vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({
    updateRating: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    addEvent: vi.fn(),
    remove: vi.fn(),
    loading: false,
    error: null,
  }),
}));

const { KarteEntryCard } = await import("./KarteEntryCard");

const karte: Karte = {
  id: "k-1",
  authorProfileId: "author-1",
  authorUsername: "cast_taro",
  authorAvatarUrl: "",
  targetProfileId: "target-1",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  isMine: false,
  rating: 4,
  status: "open",
  events: [
    { id: "e-1", stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" },
    { id: "e-2", stage: "service", outcome: "completed", tags: ["late", "smooth_communication"], note: "15分遅刻", occurredOn: "2026-10-02", createdAt: "", updatedAt: "" },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
};

const render = (props: Partial<Parameters<typeof KarteEntryCard>[0]> & { karte?: Karte }) =>
  renderToStaticMarkup(<KarteEntryCard karte={karte} mode="recent" {...props} />);

describe("KarteEntryCard identities", () => {
  it("shows and links both the author and the target in the recent list", () => {
    const html = render({ mode: "recent" });

    expect(html).toContain('href="/u/cast_taro"');
    expect(html).toContain('href="/u/guest_hanako"');
  });

  it("links the target in the own list and the author on a guest's profile", () => {
    expect(render({ mode: "my" })).toContain('href="/u/guest_hanako"');
    const onProfile = render({ mode: "target" });
    expect(onProfile).toContain('href="/u/cast_taro"');
    expect(onProfile).not.toContain('href="/u/guest_hanako"');
  });
});

describe("KarteEntryCard content", () => {
  it("shows the state, the rating and the latest event in words", () => {
    const html = render({});

    expect(html).toContain("記録中");
    expect(html).toContain("接客・問題なく完了");
    expect(html).toContain("遅刻あり・コミュニケーションが円滑");
    expect(html).toContain("15分遅刻");
    expect(html).toContain("ほか 1 件の出来事");
    expect(html).not.toContain("予約成立");
  });

  it("says unrated and closed when that is the state", () => {
    expect(render({ karte: { ...karte, rating: null } })).toContain("未評価");
    expect(render({ karte: { ...karte, status: "closed", closedAt: new Date().toISOString() } })).toContain("完了");
  });
});

describe("KarteEntryCard actions", () => {
  it("offers nothing on another cast's karte", () => {
    const html = render({ mode: "target" });

    expect(html).not.toContain("完了する");
    expect(html).not.toContain("削除");
    expect(html).not.toContain("報告");
  });

  it("offers adding, closing and deleting on an own open karte", () => {
    const html = render({ karte: { ...karte, isMine: true }, mode: "my" });

    expect(html).toContain("出来事を追加");
    expect(html).toContain("完了する");
    expect(html).toContain("削除");
    expect(html).not.toContain("再オープン");
  });

  it("disables closing an own karte without a rating and says why", () => {
    const html = render({ karte: { ...karte, isMine: true, rating: null }, mode: "my" });

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>完了する<\/button>/);
    expect(html).toContain("完了するには星を選んでください");
  });

  it("offers reopening and deleting on an own closed karte", () => {
    const html = render({ karte: { ...karte, isMine: true, status: "closed", closedAt: new Date().toISOString() }, mode: "my" });

    expect(html).toContain("再オープン");
    expect(html).toContain("削除");
    expect(html).not.toContain("出来事を追加");
    expect(html).not.toContain("完了する");
  });
});
