"use client";

import { useState } from "react";
import { Star, Loader2, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMediaUpload } from "@/modules/media/hooks/useMediaUpload";
import type { UploadedMedia } from "@/modules/media/types";
import type { SaveMediaInput } from "@/lib/types";

const MAX_MEDIA = 3;

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, content: string, media: SaveMediaInput[]) => Promise<void>;
  castName?: string;
}

export function WriteReviewModal({
  isOpen,
  onClose,
  onSubmit,
  castName = "キャスト",
}: WriteReviewModalProps) {
  const { toast } = useToast();
  const { uploadMedia, registerMedia, uploading } = useMediaUpload();
  const [score, setScore] = useState(5);
  const [content, setContent] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_MEDIA - uploadedMedia.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const uploaded = await uploadMedia(file);
        await registerMedia(uploaded);
        setUploadedMedia((prev) => [...prev, uploaded]);
      } catch {
        toast({
          title: "アップロードに失敗しました",
          variant: "destructive",
        });
      }
    }
    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

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
      const mediaInput: SaveMediaInput[] = uploadedMedia.map((m) => ({
        mediaType: m.mediaType,
        mediaId: m.mediaId,
      }));
      await onSubmit(score, content.trim(), mediaInput);
      toast({
        title: "レビューを送信しました",
        description: "承認後に公開されます",
        variant: "success",
      });
      setContent("");
      setScore(5);
      setUploadedMedia([]);
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md mx-4 bg-bg-primary rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border-primary bg-bg-primary">
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

          {/* Review Content */}
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

          {/* Media Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              写真・動画（{uploadedMedia.length}/{MAX_MEDIA}）
            </label>

            {uploadedMedia.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {uploadedMedia.map((media, index) => (
                  <div key={media.mediaId} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border-primary">
                    {media.mediaType === "image" ? (
                      <img src={media.localUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={media.localUrl} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadedMedia.length < MAX_MEDIA && (
              <label className="inline-flex items-center gap-2 px-3 py-2 text-sm text-text-secondary border border-border-primary rounded-lg cursor-pointer hover:bg-bg-secondary transition-colors">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <span>{uploading ? "アップロード中..." : "添付する"}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-4 border-t border-border-primary bg-bg-primary">
          <Button variant="ghost" onClick={onClose} disabled={submitting || uploading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || uploading || !content.trim()}>
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
