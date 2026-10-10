import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ReviewEntrySchema } from "@/stub/review/v1/service_pb";
import { KarteEntrySchema } from "@/stub/karte/v1/service_pb";

const clients = vi.hoisted(() => ({
  reviewClient: { updateEntry: vi.fn() },
  karteClient: { updateEntry: vi.fn() },
}));

vi.mock("@/lib/grpc", () => clients);
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const reviewRoute = await import("./review/[id]/route");
const karteRoute = await import("./karte/[id]/route");

function patch(route: typeof reviewRoute | typeof karteRoute, body: unknown) {
  const req = new NextRequest("http://localhost/api/entry/e-1", { method: "PATCH", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return route.PATCH(req, { params: Promise.resolve({ id: "e-1" }) });
}

beforeEach(() => {
  clients.reviewClient.updateEntry.mockReset().mockResolvedValue({ entry: create(ReviewEntrySchema, { id: "e-1" }) });
  clients.karteClient.updateEntry.mockReset().mockResolvedValue({ entry: create(KarteEntrySchema, { id: "e-1" }) });
});

describe.each([
  ["review", reviewRoute, clients.reviewClient],
  ["karte", karteRoute, clients.karteClient],
] as const)("PATCH /api/%s/[id]", (_name, route, client) => {
  it("sends an empty body through so the text can be cleared", async () => {
    await patch(route, { rating: 3, body: "" });

    expect(client.updateEntry).toHaveBeenCalledWith({ entryId: "e-1", rating: 3, body: "" }, expect.anything());
  });

  it("leaves the body out when the request does not carry one", async () => {
    await patch(route, { rating: 3 });

    expect(client.updateEntry).toHaveBeenCalledWith({ entryId: "e-1", rating: 3, body: undefined }, expect.anything());
  });
});
