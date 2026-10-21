import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getKey: undefined as ((index: number, prev: unknown) => string | null) | undefined,
  state: { activeProfileId: "p-1" as string | null, role: "guest" as string | null },
  data: undefined as unknown,
}));

vi.mock("swr/infinite", () => ({
  default: (getKey: (index: number, prev: unknown) => string | null) => {
    mocks.getKey = getKey;
    return { data: mocks.data, error: undefined, size: 1, setSize: vi.fn(), isLoading: false, isValidating: false, mutate: vi.fn() };
  },
}));
vi.mock("@/lib/swr", () => ({ fetcher: vi.fn() }));
vi.mock("../lib/revalidate", () => ({ useReviewRevalidation: vi.fn() }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
  selectRole: (state: { role: string | null }) => state.role,
}));

const { useMyReviews } = await import("./useMyReviews");

describe("useMyReviews request key", () => {
  beforeEach(() => {
    mocks.state = { activeProfileId: "p-1", role: "guest" };
  });

  it("requests the first page for a guest", () => {
    useMyReviews();

    expect(mocks.getKey?.(0, null)).toBe("/api/review/my");
  });

  it("does not request anything for a cast or before the role is known", () => {
    mocks.state = { activeProfileId: "p-1", role: "cast" };
    useMyReviews();
    expect(mocks.getKey?.(0, null)).toBeNull();

    mocks.state = { activeProfileId: "p-1", role: null };
    useMyReviews();
    expect(mocks.getKey?.(0, null)).toBeNull();
  });
});

describe("useMyReviews counts", () => {
  it("takes the counts from the first page and drops a review repeated on a later page", () => {
    mocks.state = { activeProfileId: "p-1", role: "guest" };
    mocks.data = [
      { reviews: [{ id: "a" }, { id: "b" }], hasMore: true, nextCursor: "c1", counts: { total: 3, unrated: 2 } },
      { reviews: [{ id: "b" }, { id: "c" }], hasMore: false, nextCursor: "", counts: { total: 0, unrated: 0 } },
    ];

    const result = useMyReviews();

    expect(result.counts).toEqual({ total: 3, unrated: 2 });
    expect(result.reviews.map((k) => k.id)).toEqual(["a", "b", "c"]);
    mocks.data = undefined;
  });
});
