import { describe, expect, it } from "vitest";
import { buildSavePostRequest, mapPostToView } from "./post-mappers";
import { create } from "@bufbuild/protobuf";
import type { Post } from "@/stub/post/v1/post_service_pb";
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
