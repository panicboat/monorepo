// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommentView } from "@/modules/post/lib/comment-view";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { ReplyWithParentRow } from "./ReplyWithParentRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const parentPost = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "元の投稿",
  media: [],
  createdAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
  expiresAt: "",
  author: { profileId: "author-1", displayName: "テスト太郎", username: "test_taro", avatarUrl: "", isPrivate: false, role: null },
  likesCount: 0,
  commentsCount: 1,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
} as PostView;

const comment: CommentView = {
  id: "comment-1",
  postId: "post-1",
  parentId: null,
  authorProfileId: "replier-1",
  content: "返信",
  createdAt: new Date().toISOString(),
  author: { profileId: "replier-1", displayName: "返信者", avatarUrl: "", username: "replier", isPrivate: false, role: null },
  repliesCount: 0,
  mentions: [],
};

const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  document.addEventListener("click", stopNavigation);
});

afterEach(() => {
  document.removeEventListener("click", stopNavigation);
  document.body.innerHTML = "";
});

describe("ReplyWithParentRow opening the parent post", () => {
  it("opens the parent post in the sheet on a plain click and leaves a modified click to the link", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(ReplyWithParentRow, { comment, parentPost }));
    });
    const link = container.querySelector('a[href="/posts/post-1"]')!;

    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, shiftKey: true }));
    });
    expect(usePostSheetStore.getState().open).toBe(false);

    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true });
  });
});
