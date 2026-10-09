import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";

const schedule = vi.hoisted(() => ({ listSchedules: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ scheduleClient: schedule }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const listRoute = await import("./list/route");

function list(query: string) {
  const req = new NextRequest(`http://localhost/api/schedule/list?${query}`);
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("schedule routes address the schedule owner by profile id", () => {
  beforeEach(() => {
    schedule.listSchedules.mockReset().mockResolvedValue({
      schedules: [create(ScheduleSchema, { profileId: "prof-1", workDate: "2026-10-20", startTime: "20:00", endTime: "02:00" })],
    });
  });

  it("GET /api/schedule/list reads the profileId query and returns schedules keyed profileId", async () => {
    const res = await listRoute.GET(list("profileId=prof-1&fromDate=2026-10-01&toDate=2026-10-31"));

    expect(schedule.listSchedules).toHaveBeenCalledWith(
      { profileId: "prof-1", fromDate: "2026-10-01", toDate: "2026-10-31" },
      expect.anything()
    );
    expect((await res.json()).schedules).toEqual([
      { profileId: "prof-1", workDate: "2026-10-20", startTime: "20:00", endTime: "02:00" },
    ]);
  });

  it("GET /api/schedule/list does not read the accountId query", async () => {
    await listRoute.GET(list("accountId=prof-1&fromDate=2026-10-01&toDate=2026-10-31"));

    expect(schedule.listSchedules).toHaveBeenCalledWith(
      { profileId: "", fromDate: "2026-10-01", toDate: "2026-10-31" },
      expect.anything()
    );
  });
});
