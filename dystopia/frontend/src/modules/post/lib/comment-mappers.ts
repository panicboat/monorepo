import type { Comment, CommentAuthor, ListCommentsResponse } from "@/stub/post/v1/comment_service_pb";
import type {
  CommentAuthorView,
  CommentView,
  PaginatedCommentsResponse,
} from "./comment-view";

function mapAuthor(a: CommentAuthor | undefined): CommentAuthorView | null {
  if (!a || !a.userId) return null;
  return {
    userId: a.userId,
    name: a.name,
    imageUrl: a.imageUrl,
  };
}

export function mapCommentToView(c: Comment): CommentView {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId || null,
    userId: c.userId,
    content: c.content,
    createdAt: c.createdAt,
    author: mapAuthor(c.author),
    repliesCount: c.repliesCount,
  };
}

export function mapCommentsListResponse(res: ListCommentsResponse): PaginatedCommentsResponse {
  return {
    comments: (res.comments || []).map(mapCommentToView),
    nextCursor: res.nextCursor || "",
    hasMore: !!res.hasMore,
  };
}
