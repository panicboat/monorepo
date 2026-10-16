import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { KarteSchema, KarteStage, KarteStatus, ReliabilitySummarySchema } from "@/stub/karte/v1/service_pb";

const karteClient = vi.hoisted(() => ({
  createKarte: vi.fn(),
  getKarte: vi.fn(),
  updateKarteRating: vi.fn(),
  deleteKarte: vi.fn(),
  closeKarte: vi.fn(),
  reopenKarte: vi.fn(),
  addKarteEvent: vi.fn(),
  updateKarteEvent: vi.fn(),
  deleteKarteEvent: vi.fn(),
  listKartesByTarget: vi.fn(),
  listMyKartes: vi.fn(),
  listRecentKartes: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ karteClient }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })) }));

const root = await import("./route");
const one = await import("./[id]/route");
const rating = await import("./[id]/rating/route");
const close = await import("./[id]/close/route");
const reopen = await import("./[id]/reopen/route");
const events = await import("./[id]/events/route");
const event = await import("./events/[eventId]/route");
const byTarget = await import("./by-target/route");
const my = await import("./my/route");
const recent = await import("./recent/route");

const karte = create(KarteSchema, { id: "k-1", rating: 0, status: KarteStatus.OPEN });
const eventBody = { stage: "service", outcome: "completed", tags: ["late"], note: "遅刻", occurredOn: "2026-10-01" };
const eventMessage = { stage: KarteStage.SERVICE, outcome: "completed", tags: ["late"], note: "遅刻", occurredOn: "2026-10-01" };

function request(url: string, method: string, body?: unknown, signedIn = true) {
  const req = new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  for (const fn of Object.values(karteClient)) fn.mockReset().mockResolvedValue({ karte });
});

describe("POST /api/karte", () => {
  it("creates a karte from the target, an optional rating and the first event", async () => {
    const res = await root.POST(request("/api/karte", "POST", { targetProfileId: "guest-1", rating: null, event: eventBody }));

    expect(res.status).toBe(200);
    expect(karteClient.createKarte).toHaveBeenCalledWith({ targetProfileId: "guest-1", rating: 0, event: eventMessage }, expect.anything());
    expect((await res.json()).karte).toMatchObject({ id: "k-1", rating: null, status: "open" });
  });

  it("rejects a request without a well-formed event", async () => {
    const res = await root.POST(request("/api/karte", "POST", { targetProfileId: "guest-1", event: { stage: "after" } }));

    expect(res.status).toBe(400);
    expect(karteClient.createKarte).not.toHaveBeenCalled();
  });

  it("requires a signed-in viewer", async () => {
    const res = await root.POST(request("/api/karte", "POST", { targetProfileId: "guest-1", event: eventBody }, false));

    expect(res.status).toBe(401);
  });
});

describe("one karte", () => {
  it("reads and deletes a karte", async () => {
    await one.GET(request("/api/karte/k-1", "GET"), params({ id: "k-1" }));
    const deleted = await one.DELETE(request("/api/karte/k-1", "DELETE"), params({ id: "k-1" }));

    expect(karteClient.getKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
    expect(karteClient.deleteKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
    expect(await deleted.json()).toEqual({ ok: true });
  });

  it("rates, closes and reopens a karte", async () => {
    await rating.PATCH(request("/api/karte/k-1/rating", "PATCH", { rating: null }), params({ id: "k-1" }));
    await close.POST(request("/api/karte/k-1/close", "POST"), params({ id: "k-1" }));
    await reopen.POST(request("/api/karte/k-1/reopen", "POST"), params({ id: "k-1" }));

    expect(karteClient.updateKarteRating).toHaveBeenCalledWith({ karteId: "k-1", rating: 0 }, expect.anything());
    expect(karteClient.closeKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
    expect(karteClient.reopenKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
  });

  it("adds, updates and deletes an event", async () => {
    await events.POST(request("/api/karte/k-1/events", "POST", { event: eventBody }), params({ id: "k-1" }));
    await event.PATCH(request("/api/karte/events/e-1", "PATCH", { event: eventBody }), params({ eventId: "e-1" }));
    const res = await event.DELETE(request("/api/karte/events/e-1", "DELETE"), params({ eventId: "e-1" }));

    expect(karteClient.addKarteEvent).toHaveBeenCalledWith({ karteId: "k-1", event: eventMessage }, expect.anything());
    expect(karteClient.updateKarteEvent).toHaveBeenCalledWith({ eventId: "e-1", event: eventMessage }, expect.anything());
    expect(karteClient.deleteKarteEvent).toHaveBeenCalledWith({ eventId: "e-1" }, expect.anything());
    expect((await res.json()).karte.id).toBe("k-1");
  });

  it("answers 500 when the server returns no karte", async () => {
    karteClient.closeKarte.mockResolvedValue({});

    const res = await close.POST(request("/api/karte/k-1/close", "POST"), params({ id: "k-1" }));

    expect(res.status).toBe(500);
  });
});

describe("karte lists", () => {
  it("lists a guest's kartes with the reliability", async () => {
    karteClient.listKartesByTarget.mockResolvedValue({
      kartes: [karte],
      nextCursor: "next",
      hasMore: true,
      reliability: create(ReliabilitySummarySchema, { averageRating: 3.8, raterCount: 8, karteCount: 12 }),
    });

    const res = await byTarget.GET(request("/api/karte/by-target?profile_id=guest-1&cursor=c", "GET"));
    const body = await res.json();

    expect(karteClient.listKartesByTarget).toHaveBeenCalledWith({ targetProfileId: "guest-1", limit: 20, cursor: "c" }, expect.anything());
    expect(body).toMatchObject({ nextCursor: "next", hasMore: true, reliability: { averageRating: 3.8, raterCount: 8, karteCount: 12 } });
    expect(body.kartes).toHaveLength(1);
  });

  it("requires the profile id for a guest's kartes", async () => {
    const res = await byTarget.GET(request("/api/karte/by-target", "GET"));

    expect(res.status).toBe(400);
  });

  it("lists my kartes and recent kartes", async () => {
    karteClient.listMyKartes.mockResolvedValue({ kartes: [karte], nextCursor: "", hasMore: false });
    karteClient.listRecentKartes.mockResolvedValue({ kartes: [], nextCursor: "", hasMore: false });

    const mine = await (await my.GET(request("/api/karte/my", "GET"))).json();
    const latest = await (await recent.GET(request("/api/karte/recent?cursor=c", "GET"))).json();

    expect(mine).toMatchObject({ hasMore: false, nextCursor: "" });
    expect(mine.kartes).toHaveLength(1);
    expect(latest.kartes).toEqual([]);
    expect(karteClient.listRecentKartes).toHaveBeenCalledWith({ limit: 20, cursor: "c" }, expect.anything());
  });
});
