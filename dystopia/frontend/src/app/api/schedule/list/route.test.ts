import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const schedule = vi.hoisted(() => ({ listSchedules: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ scheduleClient: schedule }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })) }));

const { GET } = await import("./route");

function list() {
  const req = new NextRequest("http://localhost/api/schedule/list?profileId=prof-1&fromDate=2026-10-01&toDate=2026-10-31");
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

beforeEach(() => {
  schedule.listSchedules.mockReset();
});

describe("GET /api/schedule/list", () => {
  it("passes hiddenByLock through", async () => {
    schedule.listSchedules.mockResolvedValue({ schedules: [], hiddenByLock: true });

    const body = await (await GET(list())).json();

    expect(body).toEqual({ schedules: [], hiddenByLock: true });
  });

  it("answers hiddenByLock false when the server does not hide the schedules", async () => {
    schedule.listSchedules.mockResolvedValue({ schedules: [] });

    const body = await (await GET(list())).json();

    expect(body.hiddenByLock).toBe(false);
  });
});
