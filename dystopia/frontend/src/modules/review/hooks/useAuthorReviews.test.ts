import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getKey: undefined as ((index: number, prev: unknown) => string | null) | undefined,
  state: { activeProfileId: "p-1" as string | null },
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
}));

const { useAuthorReviews } = await import("./useAuthorReviews");

describe("useAuthorReviews", () => {
  beforeEach(() => {
    mocks.state = { activeProfileId: "p-1" };
    mocks.data = undefined;
  });

  it("requests the reviews of the given author and returns them", () => {
    mocks.data = [{ reviews: [{ id: "a" }, { id: "b" }], hasMore: false, nextCursor: "" }];

    const result = useAuthorReviews("author-1");

    expect(mocks.getKey?.(0, null)).toBe("/api/review/by-author?profile_id=author-1");
    expect(result.reviews.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("reports whether the lock hides the reviews from the first page", () => {
    mocks.data = [{ reviews: [], hasMore: false, nextCursor: "", hiddenByLock: true }];
    expect(useAuthorReviews("author-1").hiddenByLock).toBe(true);

    mocks.data = [{ reviews: [{ id: "a" }], hasMore: false, nextCursor: "" }];
    expect(useAuthorReviews("author-1").hiddenByLock).toBe(false);

    mocks.data = undefined;
    expect(useAuthorReviews("author-1").hiddenByLock).toBe(false);
  });

  it("does not request anything without an author profile id", () => {
    useAuthorReviews(null);

    expect(mocks.getKey?.(0, null)).toBeNull();
  });
});
