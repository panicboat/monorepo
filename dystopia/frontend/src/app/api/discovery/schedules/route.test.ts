import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ScheduleSearchResultSchema } from "@/stub/discovery/v1/discovery_service_pb";
import { ProfileSummarySchema } from "@/stub/profile/v1/service_pb";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";

const discovery = vi.hoisted(() => ({ searchSchedules: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ discoveryClient: discovery }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const { GET } = await import("./route");

function search(params: Record<string, string>, signedIn = true) {
  const url = new URL("http://localhost/api/discovery/schedules");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const req = new NextRequest(url);
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const result = create(ScheduleSearchResultSchema, {
  schedule: create(ScheduleSchema, { profileId: "cast-1", workDate: "2026-10-22", startTime: "20:00", endTime: "02:00" }),
  profile: create(ProfileSummarySchema, {
    profileId: "cast-1",
    username: "suzu",
    displayName: "すず",
    avatarUrl: "https://cdn.example/suzu.png",
    isPrivate: true,
    role: 2,
    industry: "デリヘル",
  }),
  prefecture: "東京都",
  area: "新宿",
  note: "久しぶりにお店にいます",
});

describe("GET /api/discovery/schedules", () => {
  beforeEach(() => {
    discovery.searchSchedules.mockReset().mockResolvedValue({ results: [result], nextCursor: "next-1", hasMore: true });
  });

  it("passes the date, prefecture, area, industry, start band, following switch, name and cursor to the request", async () => {
    await GET(
      search({ date: "2026-10-22", prefecture: "東京都", area: "新宿", industry: "ソープ", timeBand: "night", followingOnly: "true", q: "すず", cursor: "cur-1" })
    );

    expect(discovery.searchSchedules).toHaveBeenCalledWith(
      {
        workDate: "2026-10-22",
        prefecture: "東京都",
        area: "新宿",
        industry: "ソープ",
        timeBand: "night",
        followingOnly: true,
        query: "すず",
        limit: 20,
        cursor: "cur-1",
      },
      expect.anything()
    );
  });

  it("asks for every area, band and name, without the following switch, when the parameters are absent", async () => {
    await GET(search({ date: "2026-10-22" }));

    expect(discovery.searchSchedules).toHaveBeenCalledWith(
      { workDate: "2026-10-22", prefecture: "", area: "", industry: "", timeBand: "", followingOnly: false, query: "", limit: 20, cursor: "" },
      expect.anything()
    );
  });

  it("returns each result with the schedule, the profile summary, the area and the note, plus the paging", async () => {
    const res = await GET(search({ date: "2026-10-22" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [
        {
          schedule: { profileId: "cast-1", workDate: "2026-10-22", startTime: "20:00", endTime: "02:00" },
          profile: {
            profileId: "cast-1",
            username: "suzu",
            displayName: "すず",
            avatarUrl: "https://cdn.example/suzu.png",
            isPrivate: true,
            role: "cast",
            industry: "デリヘル",
          },
          prefecture: "東京都",
          area: "新宿",
          note: "久しぶりにお店にいます",
        },
      ],
      nextCursor: "next-1",
      hasMore: true,
    });
  });

  it("drops a result that came without its schedule or profile", async () => {
    discovery.searchSchedules.mockResolvedValue({
      results: [create(ScheduleSearchResultSchema, { prefecture: "東京都" }), result],
      nextCursor: "",
      hasMore: false,
    });

    const body = await (await GET(search({ date: "2026-10-22" }))).json();

    expect(body.results).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });

  it("forwards an invalid date or band untouched and returns the server's INVALID_ARGUMENT as 400", async () => {
    discovery.searchSchedules.mockRejectedValue(new ConnectError("予定日の形式が正しくありません", Code.InvalidArgument));

    const res = await GET(search({ date: "10/22", timeBand: "dawn" }));

    expect(discovery.searchSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ workDate: "10/22", timeBand: "dawn" }),
      expect.anything()
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("予定日の形式が正しくありません");
  });

  it("requires a signed-in viewer", async () => {
    const res = await GET(search({ date: "2026-10-22" }, false));

    expect(res.status).toBe(401);
    expect(discovery.searchSchedules).not.toHaveBeenCalled();
  });
});
