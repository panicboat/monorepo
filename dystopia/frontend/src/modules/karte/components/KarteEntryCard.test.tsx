import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useDeleteKarte", () => ({
  useDeleteKarte: () => ({ remove: vi.fn(), loading: false }),
}));
vi.mock("../hooks/useReportKarte", () => ({
  useReportKarte: () => ({ report: vi.fn(), loading: false }),
}));
vi.mock("@/stores/authStore", () => ({ useAuthStore: () => null }));

const { KarteEntryCard } = await import("./KarteEntryCard");

const baseEntry = {
  id: "e-1",
  authorAccountId: "author-1",
  targetAccountId: "target-1",
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
