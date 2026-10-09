import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";

vi.mock("@/lib/grpc", () => ({
  profileClient: { disableProfile: vi.fn(), enableProfile: vi.fn(), deleteProfile: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-user-id": "acc-1" })),
}));

const { profileClient } = await import("@/lib/grpc");
const { POST: disable } = await import("./disable/route");
const { POST: enable } = await import("./enable/route");
const { DELETE: remove } = await import("./route");
const client = profileClient as unknown as Record<"disableProfile" | "enableProfile" | "deleteProfile", ReturnType<typeof vi.fn>>;

function request(method: "POST" | "DELETE", withCookie = true) {
  const req = new NextRequest("http://localhost/api/profile/prof-2", { method });
  if (withCookie) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const context = { params: Promise.resolve({ id: "prof-2" }) };

describe("profile lifecycle routes", () => {
  beforeEach(() => {
    Object.values(client).forEach((fn) => fn.mockReset());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("disables the profile named by the path and returns it as disabled", async () => {
    client.disableProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-2", disabled: true }) });

    const res = await disable(request("POST"), context);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(client.disableProfile.mock.calls[0]).toEqual([{ profileId: "prof-2" }, { headers: { "x-user-id": "acc-1" } }]);
    expect([body.profile.id, body.profile.disabled]).toEqual(["prof-2", true]);
  });

  it("enables the profile named by the path and returns it as enabled", async () => {
    client.enableProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-2", disabled: false }) });

    const res = await enable(request("POST"), context);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(client.enableProfile.mock.calls[0]).toEqual([{ profileId: "prof-2" }, { headers: { "x-user-id": "acc-1" } }]);
    expect([body.profile.id, body.profile.disabled]).toEqual(["prof-2", false]);
  });

  it("deletes the profile named by the path", async () => {
    client.deleteProfile.mockResolvedValue({});

    const res = await remove(request("DELETE"), context);

    expect(res.status).toBe(200);
    expect(client.deleteProfile.mock.calls[0]).toEqual([{ profileId: "prof-2" }, { headers: { "x-user-id": "acc-1" } }]);
  });

  it("answers 401 without an access cookie and calls nothing", async () => {
    const statuses = [
      (await disable(request("POST", false), context)).status,
      (await enable(request("POST", false), context)).status,
      (await remove(request("DELETE", false), context)).status,
    ];

    expect(statuses).toEqual([401, 401, 401]);
    Object.values(client).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("says why the last enabled profile cannot be disabled", async () => {
    client.disableProfile.mockRejectedValue(new ConnectError("last enabled profile", Code.FailedPrecondition));

    const res = await disable(request("POST"), context);

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("有効なプロフィールが他に無いため、無効にできません");
  });

  it("says why a profile that is still enabled cannot be deleted", async () => {
    client.deleteProfile.mockRejectedValue(new ConnectError("not disabled", Code.FailedPrecondition));

    const res = await remove(request("DELETE"), context);

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("有効なプロフィールは削除できません。先に無効にしてください");
  });

  it("answers 404 for a profile of another account", async () => {
    client.deleteProfile.mockRejectedValue(new ConnectError("not found", Code.NotFound));
    client.enableProfile.mockRejectedValue(new ConnectError("not found", Code.NotFound));

    expect((await remove(request("DELETE"), context)).status).toBe(404);
    expect((await enable(request("POST"), context)).status).toBe(404);
  });
});
