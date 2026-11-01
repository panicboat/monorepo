import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { GET, PUT } = await import("./route");

const ALL_ON = {
  comment: true,
  like: true,
  reply: true,
  follow: true,
  mention: true,
  quote: true,
  message: true,
  footprintUnreadBadge: true,
  footprintsRecordMyVisits: true,
};

function request(method: string, body?: unknown) {
  const req = new NextRequest("http://localhost/api/notifications/preferences", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/notifications/preferences", () => {
  beforeEach(() => {
    notifications.getNotificationPreferences.mockReset();
    notifications.updateNotificationPreferences.mockReset();
  });

  it("returns the comment preference and none of the removed fields", async () => {
    notifications.getNotificationPreferences.mockResolvedValue({ preferences: { ...ALL_ON, comment: false, message: false } });

    const res = await GET(request("GET"));

    expect(await res.json()).toEqual({ ...ALL_ON, comment: false, message: false });
  });

  it("returns every preference turned on when the monolith sends none", async () => {
    notifications.getNotificationPreferences.mockResolvedValue({});

    const res = await GET(request("GET"));

    expect(await res.json()).toEqual(ALL_ON);
  });

  it("returns the quote preference", async () => {
    notifications.getNotificationPreferences.mockResolvedValue({ preferences: { ...ALL_ON, quote: false } });

    const res = await GET(request("GET"));

    expect(await res.json()).toEqual({ ...ALL_ON, quote: false });
  });

  it("fills the omitted fields with their defaults when saving", async () => {
    notifications.updateNotificationPreferences.mockImplementation(async ({ preferences }) => ({ preferences }));

    const res = await PUT(request("PUT", { comment: false }));

    expect(notifications.updateNotificationPreferences).toHaveBeenCalledWith(
      { preferences: { ...ALL_ON, comment: false } },
      expect.anything()
    );
    expect(await res.json()).toEqual({ ...ALL_ON, comment: false });
  });
});
