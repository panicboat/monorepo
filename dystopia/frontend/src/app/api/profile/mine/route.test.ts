import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";

vi.mock("@/lib/grpc", () => ({
  profileClient: { listMyProfiles: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-user-id": "acc-1" })),
}));

const { profileClient } = await import("@/lib/grpc");
const { GET } = await import("./route");
const listMyProfiles = (profileClient as unknown as { listMyProfiles: ReturnType<typeof vi.fn> }).listMyProfiles;

function request(withCookie = true) {
  const req = new NextRequest("http://localhost/api/profile/mine");
  if (withCookie) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("GET /api/profile/mine", () => {
  beforeEach(() => {
    listMyProfiles.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns every profile of the account as views keyed by profile id", async () => {
    listMyProfiles.mockResolvedValue({
      profiles: [
        create(ProfileSchema, { id: "prof-1", displayName: "A" }),
        create(ProfileSchema, { id: "prof-2", displayName: "B", disabled: true }),
      ],
    });

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profiles.map((p: { id: string }) => p.id)).toEqual(["prof-1", "prof-2"]);
    expect(body.profiles[1].disabled).toBe(true);
    expect(JSON.stringify(body)).not.toContain("acc-1");
  });

  it("returns an empty list for an account with no profile", async () => {
    listMyProfiles.mockResolvedValue({ profiles: [] });

    const body = await (await GET(request())).json();

    expect(body.profiles).toEqual([]);
  });

  it("returns 401 without an access cookie and does not call the monolith", async () => {
    const res = await GET(request(false));

    expect(res.status).toBe(401);
    expect(listMyProfiles).not.toHaveBeenCalled();
  });

  it("maps a monolith error to its HTTP status", async () => {
    listMyProfiles.mockRejectedValue(new ConnectError("unauthenticated", Code.Unauthenticated));

    const res = await GET(request());

    expect(res.status).toBe(401);
  });
});
