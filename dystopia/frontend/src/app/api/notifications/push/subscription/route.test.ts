import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({
  registerPushSubscription: vi.fn(),
  unregisterPushSubscription: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { POST, DELETE } = await import("./route");

function request(method: string, body: unknown) {
  const req = new NextRequest("http://localhost/api/notifications/push/subscription", { method, body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/notifications/push/subscription", () => {
  beforeEach(() => {
    notifications.registerPushSubscription.mockReset().mockResolvedValue({});
    notifications.unregisterPushSubscription.mockReset().mockResolvedValue({});
  });

  it("registers the subscription's endpoint and keys", async () => {
    const res = await POST(request("POST", { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth" }));

    expect(notifications.registerPushSubscription).toHaveBeenCalledWith(
      { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth" },
      expect.anything()
    );
    expect(res.status).toBe(200);
  });

  it("sends empty strings for fields that are not strings", async () => {
    await POST(request("POST", { endpoint: 1, p256dh: null }));

    expect(notifications.registerPushSubscription).toHaveBeenCalledWith({ endpoint: "", p256dh: "", auth: "" }, expect.anything());
  });

  it("returns 400 when the monolith rejects the subscription", async () => {
    notifications.registerPushSubscription.mockRejectedValue(new ConnectError("この端末の通知を登録できませんでした", Code.InvalidArgument));

    const res = await POST(request("POST", { endpoint: "https://evil.example", p256dh: "BKey", auth: "auth" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("この端末の通知を登録できませんでした");
  });

  it("unregisters the endpoint", async () => {
    await DELETE(request("DELETE", { endpoint: "https://fcm.googleapis.com/fcm/send/a" }));

    expect(notifications.unregisterPushSubscription).toHaveBeenCalledWith({ endpoint: "https://fcm.googleapis.com/fcm/send/a" }, expect.anything());
  });
});
