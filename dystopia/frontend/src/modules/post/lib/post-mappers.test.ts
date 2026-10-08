import { describe, expect, it } from "vitest";
import { mapPostToView } from "./post-mappers";
import type { Post } from "@/stub/post/v1/post_service_pb";

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
