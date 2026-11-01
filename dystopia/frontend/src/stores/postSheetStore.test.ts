import { beforeEach, describe, expect, it } from "vitest";
import { usePostSheetStore } from "./postSheetStore";

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false, tab: "comments" });
});

describe("postSheetStore", () => {
  it("opens a post and counts each opening", () => {
    usePostSheetStore.getState().openPost("post-1");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", session: 1, open: true });

    usePostSheetStore.getState().openPost("post-2");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-2", session: 2, open: true });
  });

  it("opens the comments tab unless another tab is given", () => {
    usePostSheetStore.getState().openPost("post-1", "quotes");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", tab: "quotes" });

    usePostSheetStore.getState().openPost("post-2");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-2", tab: "comments" });
  });

  it("keeps the post while closing so the sheet can slide out with its content", () => {
    usePostSheetStore.getState().openPost("post-1");
    usePostSheetStore.getState().close();

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: false });
  });
});
