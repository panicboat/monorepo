"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Trash2, MessageCircle, Loader2 } from "lucide-react";
import { Comment } from "@/modules/post/types";
import { Badge } from "@/components/ui/Badge";
import { formatTimeAgo } from "@/lib/utils/date";
import { MediaModal } from "@/components/shared/MediaModal";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const pathname = usePathname();

  const canDelete = currentUserId && comment.userId === currentUserId;
  const isCast = comment.author?.userType === "cast";
  const isGuest = comment.author?.userType === "guest";
  const isCastPage = pathname?.startsWith("/cast/");
  const showGuestLink = isCastPage && isGuest && comment.author?.id;

  const handleMediaClick = (index: number) => {
    setModalIndex(index);
    setModalOpen(true);
  };

  return (
    <>
      <div className={`${isReply ? "ml-8 border-l-2 border-border pl-4" : ""}`}>
      <div className="py-3">
        {/* Author Info */}
        <div className="flex items-start gap-3">
          {showGuestLink ? (
            <Link
              href={`/cast/guests/${comment.author?.id}`}
              className="flex-shrink-0 hover:ring-2 hover:ring-role-cast/30 rounded-full transition-all"
            >
              {comment.author?.imageUrl && comment.author.imageUrl.trim() !== "" ? (
                <img
                  src={comment.author.imageUrl}
                  alt={comment.author.name || ""}
                  className="h-8 w-8 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-border border border-border" />
              )}
            </Link>
          ) : (
            <>
              {comment.author?.imageUrl && comment.author.imageUrl.trim() !== "" ? (
                <img
                  src={comment.author.imageUrl}
                  alt={comment.author.name || ""}
                  className="h-8 w-8 rounded-full border border-border object-cover flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div className={`h-8 w-8 rounded-full bg-border border border-border flex-shrink-0 ${comment.author?.imageUrl && comment.author.imageUrl.trim() !== "" ? "hidden" : ""}`} />
            </>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {showGuestLink ? (
                <Link
                  href={`/cast/guests/${comment.author?.id}`}
                  className="font-medium text-sm text-text-primary hover:opacity-80 transition-opacity"
                >
                  {comment.author?.name || "Unknown"}
                </Link>
              ) : (
                <span className="font-medium text-sm text-text-primary">
                  {comment.author?.name || "Unknown"}
                </span>
              )}
              {isCast && (
                <Badge variant="secondary" className="text-xs bg-neutral-800 text-white">
                  Cast
                </Badge>
              )}
              <span className="text-xs text-text-muted">
                {formatTimeAgo(comment.createdAt)}
              </span>
            </div>

            {/* Content */}
            <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {/* Media */}
            {comment.media && comment.media.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {comment.media
                  .filter((m) => m.url)
                  .map((m, i) => (
                    <div
                      key={m.id || i}
                      className="relative rounded-lg overflow-hidden max-w-[200px] cursor-pointer"
                      onClick={() => handleMediaClick(i)}
                    >
                      {m.mediaType === "video" ? (
                        <video
                          src={m.url}
                          className="max-h-32 object-cover rounded-lg"
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
                  aria-label="Reply to this comment"
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  <MessageCircle aria-hidden="true" size={14} />
                  <span>Reply</span>
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => onDelete(comment.id, isReply ? comment.parentId : undefined)}
                  disabled={isDeleting}
                  aria-label="Delete this comment"
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-error transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 aria-hidden="true" size={14} className="animate-spin" />
                  ) : (
                    <Trash2 aria-hidden="true" size={14} />
                  )}
                  <span>Delete</span>
                </button>
              )}
            </div>

            {/* Replies Toggle */}
            {!isReply && comment.repliesCount > 0 && (
              <button
                onClick={onToggleReplies}
                aria-expanded={repliesExpanded}
                aria-label={repliesExpanded ? "Hide replies" : `View ${comment.repliesCount} replies`}
                className="flex items-center gap-1 mt-2 text-xs text-text-secondary hover:text-text-secondary transition-colors"
              >
                {repliesExpanded ? (
                  <>
                    <ChevronUp aria-hidden="true" size={14} />
                    <span>Hide replies</span>
                  </>
                ) : (
                  <>
                    <ChevronDown aria-hidden="true" size={14} />
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
                  <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
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
                      aria-label="Load more replies"
                      className="ml-8 py-2 text-xs text-text-secondary hover:text-text-secondary disabled:opacity-50"
                    >
                      {repliesLoading ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin inline mr-1" />
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

      {comment.media && comment.media.length > 0 && (
        <MediaModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          media={comment.media}
          initialIndex={modalIndex}
        />
      )}
    </>
  );
}
