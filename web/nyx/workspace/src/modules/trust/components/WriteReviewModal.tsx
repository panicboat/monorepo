"use client";

import { useState } from "react";
import { Star, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, content: string) => Promise<void>;
  castName?: string;
}

export function WriteReviewModal({
  isOpen,
  onClose,
  onSubmit,
  castName = "キャスト",
}: WriteReviewModalProps) {
  const { toast } = useToast();
  const [score, setScore] = useState(5);
  const [content, setContent] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "レビュー内容を入力してください",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(score, content.trim());
      toast({
        title: "レビューを送信しました",
        description: "承認後に公開されます",
        variant: "success",
      });
      setContent("");
      setScore(5);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "送信に失敗しました";
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const displayScore = hoveredStar ?? score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-bg-primary rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">
            {castName}にレビューを書く
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-bg-secondary transition-colors"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              評価
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore(i)}
                  onMouseEnter={() => setHoveredStar(i)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      i <= displayScore
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-bg-tertiary"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-text-muted">{score}/5</span>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              レビュー内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="サービスについてのご感想をお聞かせください"
              className="w-full h-32 px-3 py-2 text-sm border border-border-primary rounded-lg bg-bg-secondary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
            />
            <p className="text-xs text-text-muted">
              レビューは承認後に公開されます
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border-primary">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !content.trim()}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            送信
          </Button>
        </div>
      </div>
    </div>
  );
}
