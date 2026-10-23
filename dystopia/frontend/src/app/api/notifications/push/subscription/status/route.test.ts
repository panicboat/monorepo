import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({ getPushSubscriptionStatus: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { POST } = await import("./route");

function request(body: unknown, signedIn = true) {
  const req = new NextRequest("http://localhost/api/notifications/push/subscription/status", { method: "POST", body: JSON.stringify(body) });
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("POST /api/notifications/push/subscription/status", () => {
  beforeEach(() => {
    notifications.getPushSubscriptionStatus.mockReset().mockResolvedValue({ subscribed: true });
  });

  it("returns whether the acting profile is subscribed on the endpoint", async () => {
    const res = await POST(request({ endpoint: "https://fcm.googleapis.com/fcm/send/a" }));

    expect(notifications.getPushSubscriptionStatus).toHaveBeenCalledWith({ endpoint: "https://fcm.googleapis.com/fcm/send/a" }, expect.anything());
    expect(await res.json()).toEqual({ subscribed: true });
  });

  it("sends an empty string when the endpoint is not a string", async () => {
    await POST(request({ endpoint: 1 }));

    expect(notifications.getPushSubscriptionStatus).toHaveBeenCalledWith({ endpoint: "" }, expect.anything());
  });

  it("requires a session", async () => {
    const res = await POST(request({ endpoint: "https://fcm.googleapis.com/fcm/send/a" }, false));

    expect(res.status).toBe(401);
    expect(notifications.getPushSubscriptionStatus).not.toHaveBeenCalled();
  });
});
