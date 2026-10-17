import { beforeEach, describe, expect, it } from "vitest";
import { usePostSheetStore } from "./postSheetStore";

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
});

describe("postSheetStore", () => {
  it("opens a post and counts each opening", () => {
    usePostSheetStore.getState().openPost("post-1");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", session: 1, open: true });

    usePostSheetStore.getState().openPost("post-2");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-2", session: 2, open: true });
  });

  it("keeps the post while closing so the sheet can slide out with its content", () => {
    usePostSheetStore.getState().openPost("post-1");
    usePostSheetStore.getState().close();

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: false });
  });
});
