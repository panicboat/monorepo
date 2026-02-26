"use client";

import Link from "next/link";
import { Star, Check, X, Loader2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Review } from "../types";
import { Button } from "@/components/ui/Button";

interface ReviewCardProps {
  review: Review;
  showActions?: boolean;
  showReviewerLink?: boolean;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  actionLoading?: boolean;
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= score
              ? "text-yellow-500 fill-yellow-500"
              : "text-bg-tertiary"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewerAvatar({ url, name }: { url?: string; name?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || "Reviewer"}
        className="h-8 w-8 rounded-full object-cover border border-border"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center">
      <User className="h-4 w-4 text-info" />
    </div>
  );
}

export function ReviewCard({
  review,
  showActions = false,
  showReviewerLink = true,
  onApprove,
  onReject,
  actionLoading = false,
}: ReviewCardProps) {
  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: ja,
  });

  const hasReviewerInfo = review.reviewerName || review.reviewerAvatarUrl;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-primary p-4">
      {/* Reviewer Info (shown for pending reviews with reviewer data) */}
      {hasReviewerInfo && (
        <div className="flex items-center gap-3 mb-3">
          {showReviewerLink && review.reviewerId ? (
            <Link
              href={`/cast/guests/${review.reviewerId}`}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <ReviewerAvatar url={review.reviewerAvatarUrl} name={review.reviewerName} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {review.reviewerName || "ゲスト"}
                </p>
                <p className="text-xs text-text-muted">{timeAgo}</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ReviewerAvatar url={review.reviewerAvatarUrl} name={review.reviewerName} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {review.reviewerName || "ゲスト"}
                </p>
                <p className="text-xs text-text-muted">{timeAgo}</p>
              </div>
            </div>
          )}
          <StarRating score={review.score} />
        </div>
      )}

      {/* Header (shown when no reviewer info) */}
      {!hasReviewerInfo && (
        <div className="flex items-center justify-between mb-2">
          <StarRating score={review.score} />
          <span className="text-xs text-text-muted">{timeAgo}</span>
        </div>
      )}

      {/* Content */}
      {review.content && (
        <p className="text-sm text-text-secondary mb-3">{review.content}</p>
      )}

      {/* Media */}
      {review.media && review.media.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {review.media.map((m) => (
            <div key={m.id} className="w-20 h-20 rounded-lg overflow-hidden border border-border-primary">
              {m.mediaType === "image" ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="relative w-full h-full">
                  {m.thumbnailUrl ? (
                    <img
                      src={m.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={m.url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
                      <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-black border-b-[5px] border-b-transparent ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status badge for pending */}
      {review.status === "pending" && (
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 mb-3">
          承認待ち
        </div>
      )}

      {/* Actions */}
      {showActions && review.status === "pending" && (
        <div className="flex items-center gap-2 pt-2 border-t border-border-primary">
          <Button
            size="sm"
            variant="default"
            onClick={() => onApprove?.(review.id)}
            disabled={actionLoading}
            className="flex-1 bg-role-cast hover:bg-role-cast-hover text-white"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                承認
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReject?.(review.id)}
            disabled={actionLoading}
            className="flex-1"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                拒否
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
