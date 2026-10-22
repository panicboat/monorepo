import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";

const schedule = vi.hoisted(() => ({ saveSchedule: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ scheduleClient: schedule }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const { POST } = await import("./route");

function save(body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/schedule/save", { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("POST /api/schedule/save", () => {
  beforeEach(() => {
    schedule.saveSchedule.mockReset().mockResolvedValue({
      schedule: create(ScheduleSchema, { profileId: "prof-1", workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" }),
    });
  });

  it("passes the announcement fields to the request", async () => {
    const res = await POST(
      save({ workDate: "2026-10-24", startTime: "20:00", endTime: "02:00", announce: true, announceTime: "09:00", announceNote: "お待ちしてます！" })
    );

    expect(schedule.saveSchedule).toHaveBeenCalledWith(
      { workDate: "2026-10-24", startTime: "20:00", endTime: "02:00", announce: true, announceTime: "09:00", announceNote: "お待ちしてます！" },
      expect.anything()
    );
    expect((await res.json()).schedule).toEqual({ profileId: "prof-1", workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" });
  });

  it("sends no announcement when the fields are absent", async () => {
    await POST(save({ workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" }));

    expect(schedule.saveSchedule).toHaveBeenCalledWith(
      { workDate: "2026-10-24", startTime: "20:00", endTime: "02:00", announce: false, announceTime: "", announceNote: "" },
      expect.anything()
    );
  });

  it("returns 400 with the monolith's validation message", async () => {
    schedule.saveSchedule.mockRejectedValue(new ConnectError("お知らせの時刻は予定の終了より前にしてください", Code.InvalidArgument));

    const res = await POST(save({ workDate: "2026-10-24", startTime: "06:00", endTime: "08:00", announce: true, announceTime: "09:00" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("お知らせの時刻は予定の終了より前にしてください");
  });
});
