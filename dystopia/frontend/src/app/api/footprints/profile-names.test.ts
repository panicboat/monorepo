import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const footprints = vi.hoisted(() => ({ recordVisit: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ footprintsClient: footprints }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const visitRoute = await import("./visit/route");

function visit(body: unknown) {
  const req = new NextRequest("http://localhost/api/footprints/visit", { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("footprints routes address the visited profile by profile id", () => {
  beforeEach(() => {
    footprints.recordVisit.mockReset().mockResolvedValue({});
  });

  it("POST /api/footprints/visit records the visit to visitedProfileId and ignores visitedAccountId", async () => {
    await visitRoute.POST(visit({ visitedProfileId: "prof-1" }));
    await visitRoute.POST(visit({ visitedAccountId: "prof-2" }));

    expect(footprints.recordVisit.mock.calls.map(([message]) => message)).toEqual([
      { visitedProfileId: "prof-1" },
      { visitedProfileId: "" },
    ]);
  });
});
