import { beforeEach, describe, expect, it } from "vitest";
import { usePostQuoteCountStore } from "./postQuoteCountStore";

describe("postQuoteCountStore", () => {
  beforeEach(() => {
    usePostQuoteCountStore.setState({ counts: {} });
  });

  it("adds one to the base count when the post has no stored count yet", () => {
    usePostQuoteCountStore.getState().addOne("post-1", 4);

    expect(usePostQuoteCountStore.getState().counts).toEqual({ "post-1": 5 });
  });

  it("adds one to the stored count and ignores the base count once a count is stored", () => {
    usePostQuoteCountStore.getState().setCount("post-1", 7);

    usePostQuoteCountStore.getState().addOne("post-1", 4);
    usePostQuoteCountStore.getState().addOne("post-1", 4);

    expect(usePostQuoteCountStore.getState().counts).toEqual({ "post-1": 9 });
  });

  it("keeps the counts of other posts", () => {
    usePostQuoteCountStore.getState().setCount("post-1", 7);

    usePostQuoteCountStore.getState().addOne("post-2", 0);

    expect(usePostQuoteCountStore.getState().counts).toEqual({ "post-1": 7, "post-2": 1 });
  });
});
