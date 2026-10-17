import { describe, expect, it } from "vitest";
import { mapPostToView } from "./post-mappers";
import { create } from "@bufbuild/protobuf";
import type { Post } from "@/stub/post/v1/post_service_pb";
import { ProfileSummarySchema } from "@/stub/profile/v1/service_pb";

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
