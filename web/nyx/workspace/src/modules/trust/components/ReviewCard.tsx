"use client";

import { Star, Check, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Review } from "../types";
import { Button } from "@/components/ui/Button";

interface ReviewCardProps {
  review: Review;
  showActions?: boolean;
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

export function ReviewCard({
  review,
  showActions = false,
  onApprove,
  onReject,
  actionLoading = false,
}: ReviewCardProps) {
  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: ja,
  });

  return (
    <div className="rounded-lg border border-border-primary bg-bg-primary p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <StarRating score={review.score} />
        <span className="text-xs text-text-muted">{timeAgo}</span>
      </div>

      {/* Content */}
      {review.content && (
        <p className="text-sm text-text-secondary mb-3">{review.content}</p>
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
