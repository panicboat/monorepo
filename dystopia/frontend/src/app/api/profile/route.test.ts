import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";

vi.mock("@/lib/grpc", () => ({
  profileClient: { getProfile: vi.fn(), saveProfile: vi.fn(), createProfile: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-user-id": "acc-1" })),
}));

const { profileClient } = await import("@/lib/grpc");
const { GET, POST } = await import("./route");
const client = profileClient as unknown as Record<"getProfile" | "createProfile", ReturnType<typeof vi.fn>>;

function request(method: string, body?: unknown) {
  const req = new NextRequest("http://localhost/api/profile", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/profile", () => {
  beforeEach(() => {
    client.getProfile.mockReset();
    client.createProfile.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("GET asks for the acting profile by passing an empty profile id", async () => {
    client.getProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-1" }) });

    const res = await GET(request("GET"));

    expect(client.getProfile).toHaveBeenCalledWith({ profileId: "" }, expect.objectContaining({ headers: expect.any(Object) }));
    expect((await res.json()).profile.id).toBe("prof-1");
  });

  it("POST creates a profile from the display name and the username", async () => {
    client.createProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-1", username: "coco_01" }) });

    const res = await POST(request("POST", { displayName: "Coco", username: "coco_01" }));

    expect(client.createProfile).toHaveBeenCalledWith(
      { displayName: "Coco", username: "coco_01" },
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).profile.id).toBe("prof-1");
  });

  it("POST sends an empty username when none is given", async () => {
    client.createProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-1" }) });

    await POST(request("POST", { displayName: "Coco" }));

    expect(client.createProfile).toHaveBeenCalledWith({ displayName: "Coco", username: "" }, expect.any(Object));
  });

  it("POST returns 400 with the monolith's message for an invalid or taken username", async () => {
    client.createProfile.mockRejectedValue(new ConnectError("このユーザー名は使用できません", Code.InvalidArgument));

    const res = await POST(request("POST", { displayName: "Coco", username: "taken" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("このユーザー名は使用できません");
  });

  it("POST returns 422 when the account is at its profile limit", async () => {
    client.createProfile.mockRejectedValue(new ConnectError("limit", Code.FailedPrecondition));

    const res = await POST(request("POST", { displayName: "Coco" }));

    expect(res.status).toBe(422);
  });
});
