import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useDeleteReview", () => ({
  useDeleteReview: () => ({ remove: vi.fn(), loading: false }),
}));
vi.mock("../hooks/useHideReview", () => ({
  useHideReview: () => ({ hide: vi.fn(), loading: false }),
}));
vi.mock("../hooks/useUnhideReview", () => ({
  useUnhideReview: () => ({ unhide: vi.fn(), loading: false }),
}));
vi.mock("@/stores/authStore", () => ({ useAuthStore: () => null }));

const { ReviewEntryCard } = await import("./ReviewEntryCard");

const baseEntry = {
  id: "e-1",
  authorProfileId: "author-1",
  targetProfileId: "target-1",
  authorUsername: "guest_hanako",
  authorAvatarUrl: "",
  targetUsername: "cast_taro",
  targetAvatarUrl: "",
  rating: 4.5,
  body: "review body",
  hidden: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ReviewEntryCard recent mode", () => {
  it("shows both author and target identities", () => {
    const html = renderToStaticMarkup(
      <ReviewEntryCard entry={baseEntry} mode="recent" />,
    );

    expect(html).toContain("guest_hanako");
    expect(html).toContain("cast_taro");
  });
});
