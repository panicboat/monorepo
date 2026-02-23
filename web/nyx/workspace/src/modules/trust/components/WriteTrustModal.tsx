"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Loader2, X, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMyTagNames } from "../hooks/useMyTagNames";
import { useTaggings } from "../hooks/useTaggings";
import { TagPill } from "./TagPill";
import { TagSelector } from "./TagSelector";

interface WriteTrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName?: string;
  onSubmitReview?: (score: number, content: string) => Promise<void>;
  /** Cast→Guest reviews don't require content */
  contentRequired?: boolean;
  /** Cast→Guest reviews show different message */
  isCastReview?: boolean;
}

export function WriteTrustModal({
  isOpen,
  onClose,
  targetId,
  targetName = "対象",
  onSubmitReview,
  contentRequired = true,
  isCastReview = false,
}: WriteTrustModalProps) {
  const { toast } = useToast();

  // Tags state
  const { tagNames } = useMyTagNames();
  const {
    targetTaggings,
    fetchTargetTags,
    addTagging,
    removeTagging,
    loading: taggingsLoading,
  } = useTaggings();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [addingTag, setAddingTag] = useState(false);
  const [tagsInitialized, setTagsInitialized] = useState(false);

  // Review state
  const [score, setScore] = useState(5);
  const [content, setContent] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load tags when modal opens
  const loadTags = useCallback(async () => {
    try {
      await fetchTargetTags(targetId);
    } catch (e) {
      console.error("Failed to load tags:", e);
    } finally {
      setTagsInitialized(true);
    }
  }, [fetchTargetTags, targetId]);

  useEffect(() => {
    if (isOpen && !tagsInitialized) {
      loadTags();
    }
  }, [isOpen, tagsInitialized, loadTags]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setScore(5);
      setHoveredStar(null);
    }
  }, [isOpen]);

  const handleAddTag = async (tagName: string) => {
    setAddingTag(true);
    try {
      await addTagging(tagName, targetId);
      await fetchTargetTags(targetId);
      toast({
        title: "タグを追加しました",
        variant: "success",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "タグの追加に失敗しました";
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveTag = async (taggingId: string) => {
    setRemovingIds((prev) => new Set([...prev, taggingId]));
    try {
      await removeTagging(taggingId);
      toast({
        title: "タグを解除しました",
        variant: "success",
      });
    } catch (e) {
      console.error("Failed to remove tagging:", e);
      toast({
        title: "エラー",
        description: "タグの解除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(taggingId);
        return next;
      });
    }
  };

  const handleSubmitReview = async () => {
    if (!onSubmitReview) {
      onClose();
      return;
    }

    if (contentRequired && !content.trim()) {
      toast({
        title: "レビュー内容を入力してください",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitReview(score, content.trim());
      toast({
        title: "レビューを送信しました",
        description: isCastReview ? "レビューが公開されました" : "承認後に公開されます",
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
  const appliedTagNames = targetTaggings.map((t) => t.tagName);
  const canSubmitReview = !contentRequired || content.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-bg-primary rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border-primary bg-bg-primary">
          <h2 className="text-lg font-semibold text-text-primary">
            {targetName}にノートを残す
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-bg-secondary transition-colors"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Tags Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-text-muted" />
              <h4 className="text-sm font-bold text-text-primary">タグ</h4>
            </div>

            {!tagsInitialized ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            ) : (
              <>
                {targetTaggings.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {targetTaggings.map((tagging) => (
                      <TagPill
                        key={tagging.id}
                        name={tagging.tagName}
                        variant={isCastReview ? "cast" : "guest"}
                        onRemove={() => handleRemoveTag(tagging.id)}
                        removing={removingIds.has(tagging.id)}
                      />
                    ))}
                  </div>
                )}

                {targetTaggings.length === 0 && (
                  <p className="text-sm text-text-muted">タグはまだありません</p>
                )}

                <TagSelector
                  suggestions={tagNames}
                  appliedTagNames={appliedTagNames}
                  onAdd={handleAddTag}
                  loading={addingTag || taggingsLoading}
                />
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border-primary" />

          {/* Review Section */}
          {onSubmitReview && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Star className="h-4 w-4 text-text-muted" />
                レビュー
              </h4>

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
                  レビュー内容{" "}
                  {contentRequired && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    isCastReview
                      ? "ゲストについてのメモを残せます（任意）"
                      : "サービスについてのご感想をお聞かせください"
                  }
                  className="w-full h-24 px-3 py-2 text-sm border border-border-primary rounded-lg bg-bg-secondary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
                />
                {!isCastReview && (
                  <p className="text-xs text-text-muted">
                    レビューは承認後に公開されます
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-4 border-t border-border-primary bg-bg-primary">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          {onSubmitReview ? (
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || !canSubmitReview}
              className={isCastReview ? "bg-role-cast hover:bg-role-cast-hover" : "bg-info hover:bg-info-hover"}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              送信
            </Button>
          ) : (
            <Button onClick={onClose}>完了</Button>
          )}
        </div>
      </div>
    </div>
  );
}
