import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReplyWithParentRow } from "./ReplyWithParentRow";
import type { CommentView } from "@/modules/post/lib/comment-view";
import type { PostView } from "@/modules/post/lib/post-view";
import { formatTimeAgo } from "@/lib/utils/date";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

const baseComment: CommentView = {
  id: "comment-1",
  postId: "post-1",
  parentId: null,
  authorProfileId: "author-1",
  content: "Nice post!",
  createdAt: new Date().toISOString(),
  author: {
    profileId: "author-1",
    displayName: "Coco",
    avatarUrl: "",
    isPrivate: false,
    role: null,
    industry: "",
    username: "coco_u",
  },
  repliesCount: 0,
  mentions: [],
};

const parentPost: PostView = {
  id: "parent-post-1",
  authorProfileId: "parent-author-1",
  content: "Parent post",
  media: [],
  createdAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
  expiresAt: "",
  author: {
    profileId: "parent-author-1",
    displayName: "Parent",
    username: "parent",
    avatarUrl: "",
    isPrivate: false,
    role: null,
    industry: "",
  },
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
};

describe("ReplyWithParentRow", () => {
  it("links the reply author's avatar and name to their profile when a username is present", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={null} />
    );

    expect(html).toMatch(/<a[^>]*href="\/u\/coco_u"/);
  });

  it("does not link the reply author when there is no username", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow
        comment={{ ...baseComment, author: { ...baseComment.author!, username: "" } }}
        parentPost={null}
      />
    );

    expect(html).not.toContain('<a href="/u/');
  });

  it("preserves the parent post preview layout classes", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={parentPost} />
    );

    expect(html).toContain('class="mt-1 line-clamp-2 text-sm text-text-primary"');
  });

  it("previews an announcement without a note as one schedule line", () => {
    const schedule = { workDate: "2026-10-23", startTime: "20:00", endTime: "02:00" };
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={{ ...parentPost, content: "", schedule }} />
    );

    expect(html).toContain("予定 10/23（金）20:00〜02:00 翌日");
  });

  it("previews a start before 05:00 as the next day", () => {
    const schedule = { workDate: "2026-10-23", startTime: "01:00", endTime: "05:00" };
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={{ ...parentPost, content: "", schedule }} />
    );

    expect(html).toContain("予定 10/23（金）01:00〜05:00 翌日");
  });

  it("previews a schedule that ends on its work date without the next-day label", () => {
    const schedule = { workDate: "2026-10-23", startTime: "10:00", endTime: "18:00" };
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={{ ...parentPost, content: "", schedule }} />
    );

    expect(html).toContain("予定 10/23（金）10:00〜18:00");
    expect(html).not.toContain("翌日");
  });

  it("previews the note of an announcement instead of the schedule line", () => {
    const schedule = { workDate: "2026-10-23", startTime: "20:00", endTime: "02:00" };
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={{ ...parentPost, content: "お待ちしてます！", schedule }} />
    );

    expect(html).toContain("お待ちしてます！");
    expect(html).not.toContain("予定");
  });

  it("dates the parent post by its display start", () => {
    const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const publishedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={{ ...parentPost, createdAt, publishedAt }} />
    );

    expect(html).toContain(formatTimeAgo(publishedAt));
    expect(html).not.toContain(formatTimeAgo(createdAt));
  });

  it("preserves the comment body whitespace layout class", () => {
    const html = renderToStaticMarkup(
      <ReplyWithParentRow comment={baseComment} parentPost={null} />
    );

    expect(html).toContain('class="mt-1 whitespace-pre-wrap text-text-primary"');
  });
});
