import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const reportClient = vi.hoisted(() => ({ createReport: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ reportClient }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })) }));

const { POST } = await import("./route");

const body = { targetType: "post", targetId: "post-1", reason: "threat", note: "repeated" };

function request(payload: unknown, signedIn = true) {
  const req = new NextRequest("http://localhost/api/reports", { method: "POST", body: JSON.stringify(payload) });
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

beforeEach(() => {
  reportClient.createReport.mockReset().mockResolvedValue({});
});

describe("POST /api/reports", () => {
  it("passes the report to the service with the viewer's headers", async () => {
    const res = await POST(request(body));

    expect(res.status).toBe(200);
    expect(reportClient.createReport).toHaveBeenCalledWith(body, { headers: { "x-profile-id": "viewer-1" } });
  });

  it("requires a signed-in viewer", async () => {
    const res = await POST(request(body, false));

    expect(res.status).toBe(401);
    expect(reportClient.createReport).not.toHaveBeenCalled();
  });

  it("answers 404 when the target cannot be reported", async () => {
    reportClient.createReport.mockRejectedValue(new ConnectError("Target not found", Code.NotFound));

    const res = await POST(request(body));

    expect(res.status).toBe(404);
  });
});
