import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePost: vi.fn(),
  cardProps: null as null | { inDetail?: boolean },
}));

vi.mock("../hooks/usePost", () => ({ usePost: mocks.usePost }));
vi.mock("./PostCardBinding", () => ({
  PostCardBinding: (props: { inDetail?: boolean }) => {
    mocks.cardProps = props;
    return <div>post-card</div>;
  },
}));
vi.mock("./CommentComposer", () => ({ CommentComposer: ({ postId }: { postId: string }) => <div>composer:{postId}</div> }));
vi.mock("./CommentList", () => ({ CommentList: ({ postId }: { postId: string }) => <div>comments:{postId}</div> }));

const { PostDetailContent } = await import("./PostDetailContent");

beforeEach(() => {
  mocks.cardProps = null;
});

describe("PostDetailContent", () => {
  it("shows the post without detail links, then the comments", () => {
    mocks.usePost.mockReturnValue({ post: { id: "post-1", commentsCount: 2 }, loading: false, error: undefined });

    const html = renderToStaticMarkup(<PostDetailContent postId="post-1" />);

    expect(mocks.usePost).toHaveBeenCalledWith("post-1");
    expect(mocks.cardProps?.inDetail).toBe(true);
    expect(html).toContain("コメント（2 件）");
    expect(html).toContain("composer:post-1");
    expect(html).toContain("comments:post-1");
  });

  it("says it is loading and that a missing post was not found", () => {
    mocks.usePost.mockReturnValue({ post: null, loading: true, error: undefined });
    expect(renderToStaticMarkup(<PostDetailContent postId="post-1" />)).toContain("読み込み中…");

    mocks.usePost.mockReturnValue({ post: null, loading: false, error: new Error("not found") });
    expect(renderToStaticMarkup(<PostDetailContent postId="post-1" />)).toContain("投稿が見つかりませんでした。");
  });
});
