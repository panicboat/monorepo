// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));
const revalidate = vi.hoisted(() => ({ revalidateKarte: vi.fn() }));
vi.mock("../lib/revalidate", () => revalidate);

const { useKarteMutations } = await import("./useKarteMutations");

const hook: { current: ReturnType<typeof useKarteMutations> | null } = { current: null };
function Probe() {
  hook.current = useKarteMutations();
  return null;
}

const event = { stage: "service" as const, outcome: "completed", tags: [], note: "", occurredOn: "2026-10-01" };
let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.authFetch.mockReset().mockResolvedValue({ karte: { id: "k-1" } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useKarteMutations", () => {
  it("sends each change to its route and returns the karte", async () => {
    const calls: [string, unknown][] = [
      ["create", () => hook.current!.create("guest-1", null, event)],
      ["rating", () => hook.current!.updateRating("k-1", 4)],
      ["add", () => hook.current!.addEvent("k-1", event)],
      ["update", () => hook.current!.updateEvent("e-1", event)],
    ];
    for (const [, run] of calls) {
      let result: unknown;
      await act(async () => {
        result = await (run as () => Promise<unknown>)();
      });
      expect(result).toEqual({ id: "k-1" });
    }

    expect(mocks.authFetch.mock.calls).toEqual([
      ["/api/karte", { method: "POST", body: { targetProfileId: "guest-1", rating: null, event } }],
      ["/api/karte/k-1/rating", { method: "PATCH", body: { rating: 4 } }],
      ["/api/karte/k-1/events", { method: "POST", body: { event } }],
      ["/api/karte/events/e-1", { method: "PATCH", body: { event } }],
    ]);
  });

  it("deletes an event and returns what the server answers", async () => {
    let result: unknown;
    await act(async () => {
      result = await hook.current!.removeEvent("e-1");
    });

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/karte/events/e-1", { method: "DELETE" });
    expect(result).toEqual({ karte: { id: "k-1" } });
  });

  it("deletes a karte and reports whether it worked", async () => {
    let removed: boolean | undefined;
    await act(async () => {
      removed = await hook.current!.remove("k-1");
    });

    expect(removed).toBe(true);
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/karte/k-1", { method: "DELETE" });
  });

  it("keeps the server's message and returns null when a change fails", async () => {
    mocks.authFetch.mockRejectedValue(new Error("Rating out of range"));
    let result: unknown = "untouched";

    await act(async () => {
      result = await hook.current!.updateRating("k-1", 4);
    });

    expect(result).toBeNull();
    expect(hook.current!.error?.message).toBe("Rating out of range");
  });

  it("refreshes the karte data after a change, whether it worked or not", async () => {
    revalidate.revalidateKarte.mockClear();
    await act(async () => {
      await hook.current!.updateRating("k-1", 4);
    });
    expect(revalidate.revalidateKarte).toHaveBeenCalledTimes(1);

    mocks.authFetch.mockRejectedValue(new Error("Karte not found"));
    await act(async () => {
      await hook.current!.addEvent("k-1", event);
    });
    expect(revalidate.revalidateKarte).toHaveBeenCalledTimes(2);
  });
});
