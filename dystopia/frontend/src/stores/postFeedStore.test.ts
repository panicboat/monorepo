import { describe, expect, it } from "vitest";
import { usePostFeedStore } from "./postFeedStore";

describe("usePostFeedStore", () => {
  it("bumps the version each time a post is created", () => {
    const before = usePostFeedStore.getState().version;

    usePostFeedStore.getState().notifyPostCreated();

    expect(usePostFeedStore.getState().version).toBe(before + 1);
  });

  it("bumps again on a subsequent notification", () => {
    usePostFeedStore.getState().notifyPostCreated();
    const before = usePostFeedStore.getState().version;

    usePostFeedStore.getState().notifyPostCreated();

    expect(usePostFeedStore.getState().version).toBe(before + 1);
  });
});
