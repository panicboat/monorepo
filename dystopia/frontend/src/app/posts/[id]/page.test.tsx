import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "post-1" }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/modules/post/components/PostDetailContent", () => ({
  PostDetailContent: ({ postId, initialTab }: { postId: string; initialTab?: string }) => (
    <div>
      detail:{postId}
      tab:{initialTab}
    </div>
  ),
}));

const { default: PostDetailPage } = await import("./page");

beforeEach(() => {
  mocks.search = "";
});

describe("PostDetailPage", () => {
  it("shows the post's detail for the id in the URL", () => {
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("detail:post-1");
  });

  it("opens the quotes tab from ?tab=quotes and ignores unknown values", () => {
    mocks.search = "tab=quotes";
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("tab:quotes");

    mocks.search = "tab=comments";
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("tab:comments");

    mocks.search = "tab=unknown";
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("tab:comments");

    mocks.search = "";
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("tab:comments");
  });
});
