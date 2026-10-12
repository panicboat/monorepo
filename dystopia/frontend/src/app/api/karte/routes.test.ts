import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { KarteEntrySchema } from "@/stub/karte/v1/service_pb";

const client = vi.hoisted(() => Object.fromEntries(["createEntry", "updateEntry", "deleteEntry", "getEntry", "addEvent", "updateEvent", "deleteEvent", "closeEntry", "reopenEntry", "listMyEntries", "listRecentEntries", "listEntriesByTarget"].map((name) => [name, vi.fn()])));
vi.mock("@/lib/grpc", () => ({ karteClient: client }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: async () => ({ "x-user-id": "owner", "x-profile-id": "profile" }) }));

const root = await import("./route");
const detail = await import("./[id]/route");
const events = await import("./[id]/events/route");
const eventDetail = await import("./[id]/events/[eventId]/route");
const close = await import("./[id]/close/route");
const reopen = await import("./[id]/reopen/route");
const mine = await import("./my/route");
const target = await import("./by-target/route");
const id = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id, eventId }) };
const input = { stage: "booking", outcome: "confirmed", tags: [], note: "", occurredOn: "2026-10-12" };

function request(method: string, body?: unknown, authenticated = true, url = "http://localhost/api/karte") {
  const req = new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (authenticated) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

beforeEach(() => {
  for (const method of Object.values(client)) method.mockReset().mockResolvedValue({ entry: create(KarteEntrySchema, { id, status: "open", eventCount: 1 }) });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("karte HTTP contracts", () => {
  it("creates an unrated chart with its first event", async () => {
    const response = await root.POST(request("POST", { targetProfileId: id, rating: null, firstEvent: input }));
    expect(response.status).toBe(200);
    expect(client.createEntry.mock.calls[0][0].firstEvent).toEqual({ stage: "booking", outcome: "confirmed", tags: [], note: "", occurredOn: "2026-10-12" });
    expect((await response.json()).entry.rating).toBeNull();
  });

  it.each([0, 6, false, "3", 1.5])("rejects invalid JSON rating %j before mutation", async (rating) => {
    const response = await root.POST(request("POST", { targetProfileId: id, rating, firstEvent: input }));
    expect(response.status).toBe(400);
    expect(client.createEntry).not.toHaveBeenCalled();
  });

  it.each([null, [], false])("rejects a non-object body %j", async (body) => {
    expect((await root.POST(request("POST", body))).status).toBe(400);
  });

  it("rejects malformed JSON and a missing first event", async () => {
    const broken = new NextRequest("http://localhost/api/karte", { method: "POST", body: "{" });
    broken.cookies.set(ACCESS_COOKIE, "token");
    expect((await root.POST(broken)).status).toBe(400);
    expect((await root.POST(request("POST", { targetProfileId: id }))).status).toBe(400);
  });

  it("distinguishes omitted, cleared and set ratings", async () => {
    for (const body of [{}, { rating: null }, { rating: 5 }]) await detail.PATCH(request("PATCH", body), context);
    const bodies = client.updateEntry.mock.calls.map(([body]) => body);
    expect(bodies[0]).not.toHaveProperty("rating");
    expect(bodies[1]).toMatchObject({ entryId: id, rating: 0 });
    expect(bodies[2]).toMatchObject({ entryId: id, rating: 5 });
  });

  it.each([0, 6, false, "3", 1.5])("rejects invalid update rating %j", async (rating) => {
    expect((await detail.PATCH(request("PATCH", { rating }), context)).status).toBe(400);
    expect(client.updateEntry).not.toHaveBeenCalled();
  });

  it("rejects invalid events before sending them to the server", async () => {
    expect((await events.POST(request("POST", { ...input, outcome: "no_show", note: " " }), context)).status).toBe(400);
    expect((await eventDetail.PATCH(request("PATCH", { ...input, tags: ["invalid"] }), context)).status).toBe(400);
    expect(client.addEvent).not.toHaveBeenCalled();
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("can retry a failed detail read", async () => {
    client.getEntry.mockRejectedValueOnce(new ConnectError("temporarily unavailable", Code.Unavailable));
    expect((await detail.GET(request("GET"), context)).status).toBe(500);
    expect((await detail.GET(request("GET"), context)).status).toBe(200);
  });

  it("returns null for an absent average and exposes its population", async () => {
    client.listEntriesByTarget.mockResolvedValue({ entries: [], aggregate: { count: 2, authorCount: 0, ratedCount: 0 } });
    const response = await target.GET(request("GET", undefined, true, `http://localhost/api/karte/by-target?profile_id=${id}`));
    expect((await response.json()).aggregate).toEqual({ count: 2, avgRating: null, authorCount: 0, ratedCount: 0 });
  });

  it("routes detail, event and lifecycle operations through the same parent id", async () => {
    expect((await detail.GET(request("GET"), context)).status).toBe(200);
    expect((await events.POST(request("POST", input), context)).status).toBe(200);
    expect((await eventDetail.PATCH(request("PATCH", input), context)).status).toBe(200);
    expect((await eventDetail.DELETE(request("DELETE"), context)).status).toBe(200);
    expect((await close.POST(request("POST"), context)).status).toBe(200);
    expect((await reopen.POST(request("POST"), context)).status).toBe(200);
    expect(client.updateEvent.mock.calls[0][0]).toMatchObject({ entryId: id, eventId });
    expect(client.deleteEvent.mock.calls[0][0]).toEqual({ entryId: id, eventId });
  });

  it.each([[Code.Unauthenticated, 401], [Code.PermissionDenied, 403], [Code.NotFound, 404], [Code.FailedPrecondition, 409], [Code.InvalidArgument, 400]])("maps gRPC error %i to HTTP %i", async (code, expected) => {
    client.closeEntry.mockRejectedValue(new ConnectError("保存できません", code));
    expect((await close.POST(request("POST"), context)).status).toBe(expected);
  });

  it("requires authentication before invoking a mutation", async () => {
    expect((await events.POST(request("POST", input, false), context)).status).toBe(401);
    expect(client.addEvent).not.toHaveBeenCalled();
  });

  it("keeps global counts when requesting a filtered page", async () => {
    client.listMyEntries.mockResolvedValue({ entries: [], counts: { total: 4, open: 1, closed: 3 } });
    const response = await mine.GET(request("GET", undefined, true, "http://localhost/api/karte/my?status=open"));
    expect(client.listMyEntries.mock.calls[0][0]).toMatchObject({ status: "open" });
    expect((await response.json()).counts).toEqual({ total: 4, open: 1, closed: 3 });
  });
});
