import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({ getPushConfig: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { GET } = await import("./route");

function request(signedIn = true) {
  const req = new NextRequest("http://localhost/api/notifications/push/config");
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("GET /api/notifications/push/config", () => {
  it("returns the VAPID public key", async () => {
    notifications.getPushConfig.mockResolvedValue({ vapidPublicKey: "BPublicKey" });

    const res = await GET(request());

    expect(await res.json()).toEqual({ vapidPublicKey: "BPublicKey" });
  });

  it("requires a session", async () => {
    const res = await GET(request(false));

    expect(res.status).toBe(401);
  });
});
