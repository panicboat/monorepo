// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Review } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), remove: vi.fn(), removeEvent: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/swr", () => ({ fetcher: mocks.fetcher }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "p-1" }),
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: vi.fn() }),
}));
vi.mock("../hooks/useReviewMutations", () => ({
  useReviewMutations: () => ({
    updateRating: vi.fn(), addEvent: vi.fn(), updateEvent: vi.fn(), removeEvent: mocks.removeEvent,
    remove: mocks.remove, loading: false, error: null,
  }),
}));

const { ReviewDetailSheet } = await import("./ReviewDetailSheet");
const { revalidateReview } = await import("../lib/revalidate");

const subject = {
  id: "k-1", authorProfileId: "a", author: { profileId: "a", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "guest", industry: "" }, authorHidden: false,
  targetProfileId: "g", target: { profileId: "g", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
  isMine: true, rating: null,
  events: [{ id: "e-1", stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" }],
  createdAt: "", updatedAt: "", lastActivityAt: "",
} as Review;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ReviewDetailSheet deleting", () => {
  it("does not read the review again once its deletion has started", async () => {
    mocks.fetcher.mockReset().mockResolvedValue({ review: subject });
    mocks.remove.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await revalidateReview();
      return true;
    });
    vi.stubGlobal("confirm", () => true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(ReviewDetailSheet, { review: subject, open: true, onClose: vi.fn() }))
      );
    });
    mocks.fetcher.mockClear();

    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "このクチコミを削除") as HTMLButtonElement).click();
    });

    expect(mocks.remove).toHaveBeenCalledWith("k-1");
    expect(mocks.fetcher).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  const secondEvent = { id: "e-2", stage: "service", outcome: "satisfied", tags: [], note: "", occurredOn: "2026-10-02", createdAt: "", updatedAt: "" };

  async function renderSheet(review: Review, onClose = vi.fn()) {
    mocks.fetcher.mockReset().mockResolvedValue({ review });
    mocks.remove.mockReset().mockResolvedValue(true);
    mocks.removeEvent.mockReset().mockResolvedValue({ review: null });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(ReviewDetailSheet, { review, open: true, onClose }))
      );
    });
    return root;
  }

  const buttons = (label: string) => Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === label);

  it("deletes the review with its last event after saying so, then closes", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const onClose = vi.fn();
    const root = await renderSheet(subject, onClose);

    expect(buttons("削除")[0].disabled).toBe(false);
    await act(async () => buttons("削除")[0].click());

    expect(confirm).toHaveBeenCalledWith("最後の出来事を削除すると、クチコミも削除されます。よろしいですか？");
    expect(mocks.removeEvent).toHaveBeenCalledWith("e-1");
    expect(onClose).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("出来事は 1 件以上必要です");
    await act(async () => root.unmount());
  });

  it("deletes only the chosen event when the review has several", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const onClose = vi.fn();
    const root = await renderSheet({ ...subject, events: [...subject.events, secondEvent] } as Review, onClose);
    mocks.removeEvent.mockResolvedValue({ review: { ...subject, events: [secondEvent] } });

    await act(async () => buttons("削除")[0].click());

    expect(confirm).toHaveBeenCalledWith("この出来事を削除しますか？");
    expect(mocks.removeEvent).toHaveBeenCalledWith("e-1");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("says the events go with the review when deleting it", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const root = await renderSheet({ ...subject, events: [...subject.events, secondEvent] } as Review);

    await act(async () => buttons("このクチコミを削除")[0].click());

    expect(confirm).toHaveBeenCalledWith("このクチコミを削除しますか？出来事もすべて削除されます。");
    expect(mocks.remove).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

});
