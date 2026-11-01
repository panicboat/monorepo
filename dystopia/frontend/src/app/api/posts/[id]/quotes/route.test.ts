import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

vi.mock("@/lib/grpc", () => ({
  postClient: { listPostQuotes: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const { postClient } = await import("@/lib/grpc");
const { GET } = await import("./route");

const listPostQuotes = postClient.listPostQuotes as unknown as ReturnType<typeof vi.fn>;

function get(path: string, signedIn = true) {
  const req = new NextRequest(`http://localhost${path}`);
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/posts/:id/quotes", () => {
  beforeEach(() => {
    listPostQuotes.mockReset().mockResolvedValue({
      posts: [{ id: "q1", authorProfileId: "a1", content: "quoting", quotesCount: 0 }],
      nextCursor: "next-1",
      hasMore: true,
    });
  });

  it("returns the quotes of a post from the quotes route", async () => {
    const res = await GET(get("/api/posts/p1/quotes?limit=5&cursor=c1"), params("p1"));

    expect(res.status).toBe(200);
    expect(listPostQuotes).toHaveBeenCalledWith(
      { postId: "p1", limit: 5, cursor: "c1" },
      expect.objectContaining({ headers: expect.any(Object) })
    );
    const body = await res.json();
    expect(body.posts).toEqual([expect.objectContaining({ id: "q1", content: "quoting", quotedPost: null, quotesCount: 0 })]);
    expect(body.nextCursor).toBe("next-1");
    expect(body.hasMore).toBe(true);
  });

  it("starts from the first page with the default limit", async () => {
    await GET(get("/api/posts/p1/quotes"), params("p1"));

    expect(listPostQuotes).toHaveBeenCalledWith({ postId: "p1", limit: 20, cursor: "" }, expect.anything());
  });

  it("rejects a request without a session", async () => {
    const res = await GET(get("/api/posts/p1/quotes", false), params("p1"));

    expect(res.status).toBe(401);
    expect(listPostQuotes).not.toHaveBeenCalled();
  });
});
