import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useSWR: vi.fn() }));

vi.mock("swr", () => ({ default: mocks.useSWR }));
vi.mock("@/lib/swr", () => ({ fetcher: vi.fn() }));

const { useSchedules } = await import("./useSchedules");

describe("useSchedules", () => {
  it("requests the schedules of a profile through the profileId query", () => {
    mocks.useSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: vi.fn() });

    useSchedules("prof 1", "2026-10-01", "2026-10-31");
    useSchedules(null, "2026-10-01", "2026-10-31");

    expect(mocks.useSWR.mock.calls.map(([key]) => key)).toEqual([
      "/api/schedule/list?profileId=prof%201&fromDate=2026-10-01&toDate=2026-10-31",
      null,
    ]);
  });
});
