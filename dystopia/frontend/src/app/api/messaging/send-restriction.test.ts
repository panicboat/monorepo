import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { GetThreadResponseSchema, SendRestriction, ThreadSchema } from "@/stub/messaging/v1/messaging_service_pb";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";

const messaging = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  getThread: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ messagingClient: messaging }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const messagesRoute = await import("./messages/route");
const threadRoute = await import("./threads/[id]/route");

function request(path: string, init?: { method: string; body: string }) {
  const req = new NextRequest(`http://localhost${path}`, init);
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

function getThread(id: string) {
  return threadRoute.GET(request(`/api/messaging/threads/${id}`), { params: Promise.resolve({ id }) });
}

function threadResponse(sendRestriction: SendRestriction) {
  return create(GetThreadResponseSchema, {
    thread: create(ThreadSchema, {
      id: "t-1",
      counterpart: create(ProfileSchema, { id: "cast-1", username: "yuna", displayName: "ゆな" }),
    }),
    sendRestriction,
  });
}

beforeEach(() => {
  messaging.sendMessage.mockReset();
  messaging.getThread.mockReset();
});

describe("GET /api/messaging/threads/[id]", () => {
  it("returns the thread with its counterpart and the reason the viewer cannot send", async () => {
    messaging.getThread.mockResolvedValue(threadResponse(SendRestriction.FOLLOW_REQUIRED));

    const body = await (await getThread("t-1")).json();

    expect(messaging.getThread).toHaveBeenCalledWith({ threadId: "t-1" }, expect.anything());
    expect(body.thread).toMatchObject({ id: "t-1", counterpart: { profileId: "cast-1", username: "yuna", displayName: "ゆな" } });
    expect(body.sendRestriction).toBe("follow_required");
  });

  it("names each restriction the server reports", async () => {
    const cases = [
      [SendRestriction.NONE, "none"],
      [SendRestriction.BLOCKED, "blocked"],
      [SendRestriction.COUNTERPART_UNAVAILABLE, "counterpart_unavailable"],
      [SendRestriction.UNSPECIFIED, "none"],
    ] as const;

    for (const [restriction, expected] of cases) {
      messaging.getThread.mockResolvedValue(threadResponse(restriction));
      expect((await (await getThread("t-1")).json()).sendRestriction).toBe(expected);
    }
  });

  it("answers 403 for a thread the viewer is not part of", async () => {
    messaging.getThread.mockRejectedValue(new ConnectError("viewer is not a thread participant", Code.PermissionDenied));

    expect((await getThread("t-1")).status).toBe(403);
  });
});

describe("POST /api/messaging/messages when the send is refused", () => {
  const send = () =>
    messagesRoute.POST(
      request("/api/messaging/messages", { method: "POST", body: JSON.stringify({ threadId: "t-1", content: "hi" }) })
    );

  it("tells the sender that a follow is required", async () => {
    messaging.sendMessage.mockRejectedValue(
      new ConnectError("follow required", Code.FailedPrecondition, { "error-reason": "follow_required" })
    );

    const res = await send();

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "相手をフォローするとメッセージを送れます", code: "follow_required" });
  });

  it("keeps the generic message for a refusal without a reason", async () => {
    messaging.sendMessage.mockRejectedValue(new ConnectError("sender == recipient", Code.FailedPrecondition));

    const res = await send();

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("予期しないエラーが発生しました");
  });
});
