import { describe, expect, it } from "vitest";
import { buildSavePostRequest, mapPostToView, toQuotedView } from "./post-mappers";
import { create } from "@bufbuild/protobuf";
import { QuotedPostSchema, type Post } from "@/stub/post/v1/post_service_pb";
import { ProfileSummarySchema } from "@/stub/profile/v1/service_pb";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";

describe("mapPostToView mentions", () => {
  it("maps proto mentions into MentionView", () => {
    const proto = {
      id: "p1",
      authorProfileId: "a1",
      content: "hi @alice",
      media: [],
      createdAt: "",
      likesCount: 0,
      commentsCount: 0,
      visibility: "public",
      hashtags: [],
      liked: false,
      mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
    } as unknown as Post;

    const view = mapPostToView(proto);

    expect(view.mentions).toEqual([
      { profileId: "acc-1", username: "alice", position: 3, length: 6 },
    ]);
  });

  it("defaults to an empty array when mentions is absent", () => {
    const proto = {
      id: "p1", authorProfileId: "a1", content: "hi", media: [], createdAt: "",
      likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false,
    } as unknown as Post;

    const view = mapPostToView(proto);

    expect(view.mentions).toEqual([]);
  });
});

describe("mapPostToView author", () => {
  const base = {
    id: "p1", authorProfileId: "a1", content: "hi", media: [], createdAt: "",
    likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false, mentions: [],
  };

  it("carries the private flag of the author", () => {
    const author = create(ProfileSummarySchema, { profileId: "a1", username: "rin", isPrivate: true });

    const view = mapPostToView({ ...base, author } as unknown as Post);

    expect(view.author?.isPrivate).toBe(true);
  });

  it("returns a null author when the post has no author", () => {
    const view = mapPostToView(base as unknown as Post);

    expect(view.author).toBeNull();
  });
});

describe("mapPostToView schedule", () => {
  const base = {
    id: "p1", authorProfileId: "a1", content: "", media: [], createdAt: "",
    likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false, mentions: [],
  };

  it("maps the linked schedule into its date and times", () => {
    const schedule = create(ScheduleSchema, { profileId: "a1", workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" });

    const view = mapPostToView({ ...base, schedule } as unknown as Post);

    expect(view.schedule).toEqual({ workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" });
  });

  it("is null when the post has no linked schedule", () => {
    expect(mapPostToView(base as unknown as Post).schedule).toBeNull();
  });
});

describe("mapPostToView pinned", () => {
  const base = {
    id: "p1", authorProfileId: "a1", content: "", media: [], createdAt: "",
    likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false, mentions: [],
  };

  it("carries the pin of the post", () => {
    expect(mapPostToView({ ...base, pinned: true } as unknown as Post).pinned).toBe(true);
  });

  it("defaults to not pinned", () => {
    expect(mapPostToView(base as unknown as Post).pinned).toBe(false);
  });
});

describe("post display window", () => {
  const base = {
    id: "p1", authorProfileId: "a1", content: "hi", media: [], createdAt: "2026-10-01T00:00:00Z",
    likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false, mentions: [],
  };

  it("maps the display start and end", () => {
    const view = mapPostToView({ ...base, publishedAt: "2026-10-02T00:00:00Z", expiresAt: "2026-10-03T00:00:00Z" } as unknown as Post);

    expect(view.publishedAt).toBe("2026-10-02T00:00:00Z");
    expect(view.expiresAt).toBe("2026-10-03T00:00:00Z");
  });

  it("defaults both to empty", () => {
    const view = mapPostToView(base as unknown as Post);

    expect(view.publishedAt).toBe("");
    expect(view.expiresAt).toBe("");
  });
});

describe("buildSavePostRequest display window", () => {
  it("passes the display start and end through", () => {
    const req = buildSavePostRequest({ content: "hi", publishedAt: "2026-10-02T00:00:00.000Z", expiresAt: "2026-10-03T00:00:00.000Z" });

    expect(req.publishedAt).toBe("2026-10-02T00:00:00.000Z");
    expect(req.expiresAt).toBe("2026-10-03T00:00:00.000Z");
  });

  it("sends empty strings when no times are given", () => {
    const req = buildSavePostRequest({ content: "hi" });

    expect(req.publishedAt).toBe("");
    expect(req.expiresAt).toBe("");
  });
});

describe("mapPostToView quote", () => {
  const base = {
    id: "p1", authorProfileId: "a1", content: "", media: [], createdAt: "",
    likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false, mentions: [],
  };

  it("maps a quoted post and the count of quotes", () => {
    const author = create(ProfileSummarySchema, { profileId: "a2", username: "mio" });
    const schedule = create(ScheduleSchema, { profileId: "a2", workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" });
    const quotedPost = create(QuotedPostSchema, {
      available: true,
      id: "q1",
      author,
      content: "hi @alice #tag",
      media: [{ id: "m1", mediaType: "video", url: "https://cdn/v.mp4", thumbnailUrl: "https://cdn/v.jpg", mediaId: "media-1" }],
      publishedAt: "2026-10-02T00:00:00Z",
      schedule,
      mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
      hashtags: ["tag"],
    });

    const view = mapPostToView({ ...base, quotedPost, quotesCount: 3 } as unknown as Post);

    expect(view.quotesCount).toBe(3);
    expect(view.quotedPost).toEqual({
      available: true,
      id: "q1",
      author: expect.objectContaining({ profileId: "a2", username: "mio" }),
      content: "hi @alice #tag",
      media: [{ id: "m1", mediaType: "video", url: "https://cdn/v.mp4", thumbnailUrl: "https://cdn/v.jpg", mediaId: "media-1" }],
      publishedAt: "2026-10-02T00:00:00Z",
      schedule: { workDate: "2026-10-24", startTime: "20:00", endTime: "02:00" },
      mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
      hashtags: ["tag"],
    });
  });

  it("maps an unavailable quoted post to its empty fields", () => {
    const quotedPost = create(QuotedPostSchema, { available: false });

    const view = mapPostToView({ ...base, quotedPost } as unknown as Post);

    expect(view.quotedPost).toEqual({
      available: false,
      id: "",
      author: null,
      content: "",
      media: [],
      publishedAt: "",
      schedule: null,
      mentions: [],
      hashtags: [],
    });
  });

  it("is null and counts zero when the post quotes nothing", () => {
    const view = mapPostToView(base as unknown as Post);

    expect(view.quotedPost).toBeNull();
    expect(view.quotesCount).toBe(0);
  });
});

describe("buildSavePostRequest quote", () => {
  it("sends quotedPostId in the save request", () => {
    expect(buildSavePostRequest({ content: "hi", quotedPostId: "q1" }).quotedPostId).toBe("q1");
  });

  it("sends an empty quotedPostId when nothing is quoted", () => {
    expect(buildSavePostRequest({ content: "hi" }).quotedPostId).toBe("");
  });
});

describe("toQuotedView", () => {
  it("turns a post into an available quoted post without its own quote", () => {
    const post = mapPostToView({
      id: "p1", authorProfileId: "a1", content: "hi @alice #tag", media: [], createdAt: "2026-10-01T00:00:00Z", publishedAt: "2026-10-02T00:00:00Z",
      likesCount: 0, commentsCount: 0, visibility: "public", hashtags: ["tag"], liked: false,
      mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
      quotedPost: create(QuotedPostSchema, { available: true, id: "q1", content: "inner" }),
    } as unknown as Post);

    expect(toQuotedView(post)).toEqual({
      available: true,
      id: "p1",
      author: null,
      content: "hi @alice #tag",
      media: [],
      publishedAt: "2026-10-02T00:00:00Z",
      schedule: null,
      mentions: [{ profileId: "acc-1", username: "alice", position: 3, length: 6 }],
      hashtags: ["tag"],
    });
  });
});
