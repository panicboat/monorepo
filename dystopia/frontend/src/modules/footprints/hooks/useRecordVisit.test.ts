import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("react", () => ({ useCallback: (callback: unknown) => callback }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));

const { useRecordVisit } = await import("./useRecordVisit");

describe("useRecordVisit", () => {
  it("posts the visited profile as visitedProfileId", async () => {
    mocks.authFetch.mockResolvedValue({});

    await useRecordVisit()("prof-1");

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/footprints/visit", {
      method: "POST",
      body: { visitedProfileId: "prof-1" },
    });
  });
});
