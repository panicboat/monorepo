"use client";

import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Trash2, MessageCircle, Loader2 } from "lucide-react";
import { Comment } from "@/modules/social/types";
import { Badge } from "@/components/ui/Badge";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

type CommentItemProps = {
  comment: Comment;
  currentUserId?: string;
  onDelete: (commentId: string, parentId?: string) => void;
  onReply: (commentId: string) => void;
  isDeleting: boolean;
  isReply?: boolean;
  replies?: Comment[];
  repliesExpanded?: boolean;
  repliesLoading?: boolean;
  hasMoreReplies?: boolean;
  onToggleReplies?: () => void;
  onLoadMoreReplies?: () => void;
};

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  isDeleting,
  isReply = false,
  replies = [],
  repliesExpanded = false,
  repliesLoading = false,
  hasMoreReplies = false,
  onToggleReplies,
  onLoadMoreReplies,
}: CommentItemProps) {
  const canDelete = currentUserId && comment.userId === currentUserId;
  const isCast = comment.author?.userType === "cast";

  return (
    <div className={`${isReply ? "ml-8 border-l-2 border-slate-100 pl-4" : ""}`}>
      <div className="py-3">
        {/* Author Info */}
        <div className="flex items-start gap-3">
          {comment.author?.imageUrl && comment.author.imageUrl.trim() !== "" ? (
            <img
              src={comment.author.imageUrl}
              alt={comment.author.name || ""}
              className="h-8 w-8 rounded-full border border-slate-100 object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`h-8 w-8 rounded-full bg-slate-200 border border-slate-100 flex-shrink-0 ${comment.author?.imageUrl && comment.author.imageUrl.trim() !== "" ? "hidden" : ""}`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-slate-800">
                {comment.author?.name || "Unknown"}
              </span>
              {isCast && (
                <Badge variant="secondary" className="text-xs bg-slate-800 text-white">
                  Cast
                </Badge>
              )}
              <span className="text-xs text-slate-400">
                {formatTimeAgo(comment.createdAt)}
              </span>
            </div>

            {/* Content */}
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {/* Media */}
            {comment.media && comment.media.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {comment.media.map((m, i) => (
                  <div key={m.id || i} className="relative rounded-lg overflow-hidden max-w-[200px]">
                    {m.mediaType === "video" ? (
                      <video
                        src={m.url}
                        className="max-h-32 object-cover rounded-lg"
                        controls
                        muted
                      />
                    ) : (
                      <img
                        src={m.url}
                        alt=""
                        className="max-h-32 object-cover rounded-lg"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 mt-2">
              {!isReply && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <MessageCircle size={14} />
                  <span>Reply</span>
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => onDelete(comment.id, isReply ? comment.parentId : undefined)}
                  disabled={isDeleting}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  <span>Delete</span>
                </button>
              )}
            </div>

            {/* Replies Toggle */}
            {!isReply && comment.repliesCount > 0 && (
              <button
                onClick={onToggleReplies}
                className="flex items-center gap-1 mt-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                {repliesExpanded ? (
                  <>
                    <ChevronUp size={14} />
                    <span>Hide replies</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    <span>View replies ({comment.repliesCount})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {!isReply && (
        <AnimatePresence>
          {repliesExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {repliesLoading && replies.length === 0 ? (
                <div className="ml-8 py-4 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      onDelete={onDelete}
                      onReply={onReply}
                      isDeleting={isDeleting}
                      isReply
                    />
                  ))}
                  {hasMoreReplies && (
                    <button
                      onClick={onLoadMoreReplies}
                      disabled={repliesLoading}
                      className="ml-8 py-2 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                    >
                      {repliesLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                      ) : null}
                      Load more replies
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
