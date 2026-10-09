import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { MessageSchema } from "@/stub/messaging/v1/messaging_service_pb";

const messaging = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  getOrCreateThread: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ messagingClient: messaging }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const messagesRoute = await import("./messages/route");
const threadsRoute = await import("./threads/route");

function post(path: string, body: unknown) {
  const req = new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("messaging routes address the counterpart by profile id", () => {
  beforeEach(() => {
    messaging.sendMessage.mockReset().mockResolvedValue({
      message: create(MessageSchema, { id: "m-1", threadId: "t-1", senderProfileId: "viewer-1", content: "hi" }),
      threadId: "t-1",
    });
    messaging.getOrCreateThread.mockReset().mockResolvedValue({ thread: undefined });
  });

  it("POST /api/messaging/messages sends recipientProfileId and returns the sender profile", async () => {
    const res = await messagesRoute.POST(post("/api/messaging/messages", { recipientProfileId: "prof-1", content: "hi" }));

    expect(messaging.sendMessage).toHaveBeenCalledWith(
      { threadId: "", recipientProfileId: "prof-1", content: "hi" },
      expect.anything()
    );
    expect((await res.json()).message).toMatchObject({ id: "m-1", senderProfileId: "viewer-1" });
  });

  it("POST /api/messaging/messages rejects recipientAccountId", async () => {
    const res = await messagesRoute.POST(post("/api/messaging/messages", { recipientAccountId: "prof-1", content: "hi" }));

    expect(res.status).toBe(400);
    expect(messaging.sendMessage).not.toHaveBeenCalled();
  });

  it("POST /api/messaging/threads opens a thread by recipientProfileId and rejects recipientAccountId", async () => {
    const ok = await threadsRoute.POST(post("/api/messaging/threads", { recipientProfileId: "prof-1" }));
    const rejected = await threadsRoute.POST(post("/api/messaging/threads", { recipientAccountId: "prof-1" }));

    expect(ok.status).toBe(200);
    expect(rejected.status).toBe(400);
    expect(messaging.getOrCreateThread).toHaveBeenCalledTimes(1);
    expect(messaging.getOrCreateThread).toHaveBeenCalledWith({ recipientProfileId: "prof-1" }, expect.anything());
  });
});
