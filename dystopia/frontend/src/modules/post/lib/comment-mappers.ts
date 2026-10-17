import type { Comment, ListCommentsResponse } from "@/stub/post/v1/comment_service_pb";
import { mapMentionToView } from "./post-mappers";
import { summaryToView } from "@/modules/profile/lib/mappers";
import type {
  CommentView,
  PaginatedCommentsResponse,
} from "./comment-view";

export function mapCommentToView(c: Comment): CommentView {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId || null,
    authorProfileId: c.authorProfileId,
    content: c.content,
    createdAt: c.createdAt,
    author: c.author ? summaryToView(c.author) : null,
    repliesCount: c.repliesCount,
    mentions: (c.mentions || []).map(mapMentionToView),
  };
}

export function mapCommentsListResponse(res: ListCommentsResponse): PaginatedCommentsResponse {
  return {
    comments: (res.comments || []).map(mapCommentToView),
    nextCursor: res.nextCursor || "",
    hasMore: !!res.hasMore,
  };
}
