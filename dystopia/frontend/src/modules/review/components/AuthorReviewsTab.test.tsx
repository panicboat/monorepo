// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useAuthorReviews = vi.hoisted(() =>
  vi.fn(() => ({ reviews: [], hiddenByLock: false, hasMore: false, loading: false, loadMore: vi.fn() })),
);
vi.mock("../hooks/useAuthorReviews", () => ({ useAuthorReviews }));

const { AuthorReviewsTab } = await import("./AuthorReviewsTab");

describe("AuthorReviewsTab", () => {
  it("loads the given author's reviews and shows the empty state when there are none", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(AuthorReviewsTab, { authorProfileId: "guest-1" }));
    });

    expect(useAuthorReviews).toHaveBeenCalledWith("guest-1");
    expect(container.textContent).toContain("クチコミはまだありません");
  });

  it("shows the notice when hidden by lock", async () => {
    useAuthorReviews.mockReturnValueOnce({ reviews: [], hiddenByLock: true, hasMore: false, loading: false, loadMore: vi.fn() });
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(AuthorReviewsTab, { authorProfileId: "guest-1" }));
    });

    expect(container.textContent).toContain("フォローすると見られます");
    expect(container.textContent).not.toContain("クチコミはまだありません");
  });
});
