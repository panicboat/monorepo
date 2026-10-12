// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "../lib/post-view";
import { PostDetail } from "./PostDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ post: null as PostView | null, error: null as Error | null, retry: vi.fn(), add: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../hooks/usePost", () => ({ usePost: () => ({ post: state.post, error: state.error, loading: false, mutate: state.retry }) }));
vi.mock("../hooks/useComments", () => ({ useComments: () => ({ comments: [], hasMore: false, loading: false }) }));
vi.mock("../hooks/useAddComment", () => ({ useAddComment: () => ({ addComment: state.add, submitting: false, error: null }) }));
let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
async function mount() { container = document.createElement("div"); root = createRoot(container); await act(async () => root.render(<PostDetail postId="post-1" />)); }
beforeEach(() => {
  state.post = { id: "post-1", authorProfileId: "author", content: "写真付きの投稿", media: [{ id: "video", mediaType: "video", url: "https://example.com/clip.mp4", thumbnailUrl: "", mediaId: "video" }], createdAt: "", author: null, likesCount: 0, commentsCount: 2, visibility: "public", hashtags: [], mentions: [], liked: false };
  state.error = null; state.retry.mockReset(); state.add.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => root?.unmount()); });
describe("PostDetail", () => {
  it("keeps media and submits a comment for the displayed post", async () => {
    await mount(); expect(container.querySelector("video")?.src).toBe("https://example.com/clip.mp4"); expect(container.textContent).toContain("コメント（2 件）");
    const input = container.querySelector("textarea")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "また会いたいです"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(state.add).toHaveBeenCalledWith("また会いたいです"); expect(input.value).toBe("");
  });
  it("offers retry when loading the post fails", async () => {
    state.error = new Error("offline"); await mount();
    await act(async () => (container.querySelector("button") as HTMLButtonElement).click()); expect(state.retry).toHaveBeenCalled();
    expect(container.querySelector("[role='alert']")?.textContent).toContain("投稿を取得できませんでした");
  });
});
