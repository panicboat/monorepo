import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

vi.mock("@/lib/grpc", () => ({
  postClient: { listPosts: vi.fn(), savePost: vi.fn() },
  commentClient: { listCommentsByAuthor: vi.fn() },
  likeClient: { listLikedPostsByProfile: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const { postClient, commentClient, likeClient } = await import("@/lib/grpc");
const posts = await import("./route");
const commentsByAuthor = await import("./comments-by-author/route");
const likedBy = await import("./liked-by/route");

const listPosts = postClient.listPosts as unknown as ReturnType<typeof vi.fn>;
const listCommentsByAuthor = commentClient.listCommentsByAuthor as unknown as ReturnType<typeof vi.fn>;
const listLikedPostsByProfile = likeClient.listLikedPostsByProfile as unknown as ReturnType<typeof vi.fn>;

function get(path: string) {
  const req = new NextRequest(`http://localhost${path}`);
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("post list routes address the author by profile id", () => {
  beforeEach(() => {
    listPosts.mockReset().mockResolvedValue({ posts: [], nextCursor: "", hasMore: false });
    listCommentsByAuthor.mockReset().mockResolvedValue({ comments: [], postsById: {}, nextCursor: "", hasMore: false });
    listLikedPostsByProfile.mockReset().mockResolvedValue({ posts: [], nextCursor: "", hasMore: false });
  });

  it("GET /api/posts forwards author_profile_id", async () => {
    const res = await posts.GET(get("/api/posts?author_profile_id=prof-1&media_only=1"));

    expect(res.status).toBe(200);
    expect(listPosts).toHaveBeenCalledWith(
      expect.objectContaining({ authorProfileId: "prof-1", mediaOnly: true }),
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it("GET /api/posts lists every author when the parameter is absent", async () => {
    await posts.GET(get("/api/posts"));

    expect(listPosts).toHaveBeenCalledWith(expect.objectContaining({ authorProfileId: "" }), expect.anything());
  });

  it("GET /api/posts/comments-by-author forwards author_profile_id", async () => {
    const res = await commentsByAuthor.GET(get("/api/posts/comments-by-author?author_profile_id=prof-1"));

    expect(res.status).toBe(200);
    expect(listCommentsByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({ authorProfileId: "prof-1" }),
      expect.anything()
    );
  });

  it("GET /api/posts/liked-by forwards profile_id", async () => {
    const res = await likedBy.GET(get("/api/posts/liked-by?profile_id=prof-1"));

    expect(res.status).toBe(200);
    expect(listLikedPostsByProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "prof-1" }),
      expect.anything()
    );
  });
});
