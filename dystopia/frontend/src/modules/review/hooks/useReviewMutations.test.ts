// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));
const revalidate = vi.hoisted(() => ({ revalidateReview: vi.fn() }));
vi.mock("../lib/revalidate", () => revalidate);

const { useReviewMutations } = await import("./useReviewMutations");

const hook: { current: ReturnType<typeof useReviewMutations> | null } = { current: null };
function Probe() {
  hook.current = useReviewMutations();
  return null;
}

const event = { stage: "service" as const, outcome: "satisfied", tags: [], note: "", occurredOn: "2026-10-01" };
let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.authFetch.mockReset().mockResolvedValue({ review: { id: "k-1" } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useReviewMutations", () => {
  it("sends each change to its route and returns the review", async () => {
    const calls: [string, unknown][] = [
      ["create", () => hook.current!.create("guest-1", null, event)],
      ["rating", () => hook.current!.updateRating("k-1", 4)],
      ["close", () => hook.current!.close("k-1")],
      ["reopen", () => hook.current!.reopen("k-1")],
      ["add", () => hook.current!.addEvent("k-1", event)],
      ["update", () => hook.current!.updateEvent("e-1", event)],
      ["remove event", () => hook.current!.removeEvent("e-1")],
    ];
    for (const [, run] of calls) {
      let result: unknown;
      await act(async () => {
        result = await (run as () => Promise<unknown>)();
      });
      expect(result).toEqual({ id: "k-1" });
    }

    expect(mocks.authFetch.mock.calls).toEqual([
      ["/api/review", { method: "POST", body: { targetProfileId: "guest-1", rating: null, event } }],
      ["/api/review/k-1/rating", { method: "PATCH", body: { rating: 4 } }],
      ["/api/review/k-1/close", { method: "POST", body: undefined }],
      ["/api/review/k-1/reopen", { method: "POST", body: undefined }],
      ["/api/review/k-1/events", { method: "POST", body: { event } }],
      ["/api/review/events/e-1", { method: "PATCH", body: { event } }],
      ["/api/review/events/e-1", { method: "DELETE", body: undefined }],
    ]);
  });

  it("deletes a review and reports whether it worked", async () => {
    let removed: boolean | undefined;
    await act(async () => {
      removed = await hook.current!.remove("k-1");
    });

    expect(removed).toBe(true);
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/review/k-1", { method: "DELETE" });
  });

  it("keeps the server's message and returns null when a change fails", async () => {
    mocks.authFetch.mockRejectedValue(new Error("Rating required to close"));
    let result: unknown = "untouched";

    await act(async () => {
      result = await hook.current!.close("k-1");
    });

    expect(result).toBeNull();
    expect(hook.current!.error?.message).toBe("Rating required to close");
  });

  it("refreshes the review data after a change, whether it worked or not", async () => {
    revalidate.revalidateReview.mockClear();
    await act(async () => {
      await hook.current!.close("k-1");
    });
    expect(revalidate.revalidateReview).toHaveBeenCalledTimes(1);

    mocks.authFetch.mockRejectedValue(new Error("Review is closed"));
    await act(async () => {
      await hook.current!.addEvent("k-1", event);
    });
    expect(revalidate.revalidateReview).toHaveBeenCalledTimes(2);
  });
});
