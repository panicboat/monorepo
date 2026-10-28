import { describe, expect, it, vi } from "vitest";
import { createRequestBatcher } from "./request-batcher";

describe("createRequestBatcher", () => {
  it("sends ids requested in the same tick as one request without duplicates", async () => {
    const fetchMany = vi.fn(async (ids: string[]) => ({ ids }));
    const request = createRequestBatcher(fetchMany);

    const results = await Promise.all([request("a"), request("b"), request("a")]);

    expect(fetchMany).toHaveBeenCalledTimes(1);
    expect(fetchMany).toHaveBeenCalledWith(["a", "b"]);
    expect(results).toEqual([{ ids: ["a", "b"] }, { ids: ["a", "b"] }, { ids: ["a", "b"] }]);
  });

  it("sends ids requested after the previous request started as a new request", async () => {
    const fetchMany = vi.fn(async (ids: string[]) => ({ ids }));
    const request = createRequestBatcher(fetchMany);

    await request("a");
    await request("b");

    expect(fetchMany.mock.calls).toEqual([[["a"]], [["b"]]]);
  });

  it("rejects every caller of the batch when the request fails", async () => {
    const request = createRequestBatcher(async () => {
      throw new Error("throttled");
    });

    const results = await Promise.allSettled([request("a"), request("b")]);

    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
  });
});
