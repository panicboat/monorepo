import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), useSWRInfinite: vi.fn() }));

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("swr/infinite", () => ({ default: mocks.useSWRInfinite }));
vi.mock("@/lib/swr", () => ({ fetcher: vi.fn() }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "viewer-1" }),
}));

const { useCreateReview } = await import("./useCreateReview");
const { useReviewsByTarget } = await import("./useReviewsByTarget");
const { useReviewsByAuthor } = await import("./useReviewsByAuthor");

function firstPageKey(hook: (profileId: string) => unknown, profileId: string) {
  mocks.useSWRInfinite.mockReset().mockReturnValue({ data: undefined, size: 1, setSize: vi.fn(), mutate: vi.fn() });
  hook(profileId);
  return mocks.useSWRInfinite.mock.calls[0][0](0, null);
}

describe("review hooks address the author and the target by profile id", () => {
  it("posts a review about the target profile as targetProfileId", async () => {
    mocks.authFetch.mockResolvedValue({ entry: { id: "r-1" } });

    await useCreateReview().create("target 1", 4.5, "great");

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/review", {
      method: "POST",
      body: { targetProfileId: "target 1", rating: 4.5, body: "great" },
    });
  });

  it("requests reviews by target and by author through the profile_id query", () => {
    expect(firstPageKey(useReviewsByTarget, "target 1")).toBe("/api/review/by-target?profile_id=target%201");
    expect(firstPageKey(useReviewsByAuthor, "author 1")).toBe("/api/review/by-author?profile_id=author%201");
  });
});
