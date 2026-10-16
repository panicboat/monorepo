import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "post-1" }) }));
vi.mock("@/modules/post/components/PostDetailContent", () => ({
  PostDetailContent: ({ postId }: { postId: string }) => <div>detail:{postId}</div>,
}));

const { default: PostDetailPage } = await import("./page");

describe("PostDetailPage", () => {
  it("shows the post's detail for the id in the URL", () => {
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("detail:post-1");
  });
});
