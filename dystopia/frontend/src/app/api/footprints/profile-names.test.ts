import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";

const footprints = vi.hoisted(() => ({ recordVisit: vi.fn() }));
const schedule = vi.hoisted(() => ({ listSchedules: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ footprintsClient: footprints, scheduleClient: schedule }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const visitRoute = await import("./visit/route");
const scheduleListRoute = await import("../schedule/list/route");

function request(path: string, init?: { method: string; body: unknown }) {
  const req = new NextRequest(`http://localhost${path}`, init && { method: init.method, body: JSON.stringify(init.body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("footprints and schedule routes address the profile by profile id", () => {
  beforeEach(() => {
    footprints.recordVisit.mockReset().mockResolvedValue({});
    schedule.listSchedules.mockReset().mockResolvedValue({
      schedules: [create(ScheduleSchema, { profileId: "prof-1", workDate: "2026-10-20", startTime: "20:00", endTime: "02:00" })],
    });
  });

  it("POST /api/footprints/visit records the visit to visitedProfileId and ignores visitedAccountId", async () => {
    await visitRoute.POST(request("/api/footprints/visit", { method: "POST", body: { visitedProfileId: "prof-1" } }));
    await visitRoute.POST(request("/api/footprints/visit", { method: "POST", body: { visitedAccountId: "prof-2" } }));

    expect(footprints.recordVisit.mock.calls.map(([message]) => message)).toEqual([
      { visitedProfileId: "prof-1" },
      { visitedProfileId: "" },
    ]);
  });

  it("GET /api/schedule/list reads the profileId query and returns schedules keyed profileId", async () => {
    const res = await scheduleListRoute.GET(request("/api/schedule/list?profileId=prof-1&fromDate=2026-10-01&toDate=2026-10-31"));

    expect(schedule.listSchedules).toHaveBeenCalledWith(
      { profileId: "prof-1", fromDate: "2026-10-01", toDate: "2026-10-31" },
      expect.anything()
    );
    expect((await res.json()).schedules).toEqual([
      { profileId: "prof-1", workDate: "2026-10-20", startTime: "20:00", endTime: "02:00" },
    ]);
  });

  it("GET /api/schedule/list does not read the accountId query", async () => {
    await scheduleListRoute.GET(request("/api/schedule/list?accountId=prof-1&fromDate=2026-10-01&toDate=2026-10-31"));

    expect(schedule.listSchedules).toHaveBeenCalledWith(
      { profileId: "", fromDate: "2026-10-01", toDate: "2026-10-31" },
      expect.anything()
    );
  });
});
