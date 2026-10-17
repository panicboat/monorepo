import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => <span>acting-profile</span> }));
vi.mock("@/modules/post/hooks/useAddComment", () => ({
  useAddComment: () => ({ addComment: vi.fn(), submitting: false, error: null }),
}));

const { CommentComposer } = await import("./CommentComposer");
const { ReplyComposer } = await import("./ReplyComposer");

describe("comment composers", () => {
  it("shows which profile a comment is written as above the input", () => {
    const html = renderToStaticMarkup(<CommentComposer postId="post-1" />);

    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<textarea"));
  });

  it("shows which profile a reply is written as above the input", () => {
    const html = renderToStaticMarkup(<ReplyComposer postId="post-1" parentId="comment-1" onCancel={() => {}} onSubmitted={() => {}} />);

    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<textarea"));
  });
});
