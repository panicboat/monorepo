"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { CommentMedia } from "@/modules/post/types";
import { Button } from "@/components/ui/Button";
import { MediaPicker, MediaFile } from "@/components/shared/MediaPicker";
import { uploadFile } from "@/lib/media";

const MAX_CONTENT_LENGTH = 1000;
const MAX_MEDIA = 3;

type CommentFormProps = {
  onSubmit: (content: string, media: CommentMedia[]) => Promise<void>;
  isSubmitting: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  isReply?: boolean;
};

export function CommentForm({
  onSubmit,
  isSubmitting,
  placeholder = "Add a comment...",
  autoFocus = false,
  onCancel,
  isReply = false,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim() && mediaFiles.length === 0) {
      setError("Comment cannot be empty");
      return;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`Comment must be ${MAX_CONTENT_LENGTH} characters or less`);
      return;
    }

    try {
      setUploading(true);

      const uploadedMedia: CommentMedia[] = [];
      for (const mf of mediaFiles) {
        const key = await uploadFile(mf.file);
        if (key) {
          uploadedMedia.push({
            id: "",
            mediaType: mf.type,
            url: key,
          });
        }
      }

      await onSubmit(content.trim(), uploadedMedia);
      setContent("");
      mediaFiles.forEach((mf) => URL.revokeObjectURL(mf.previewUrl));
      setMediaFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  const handleMediaChange = (files: MediaFile[]) => {
    if (files.length > MAX_MEDIA) {
      setError(`Maximum ${MAX_MEDIA} files allowed`);
      return;
    }
    setError(null);
    setMediaFiles(files);
  };

  const remainingChars = MAX_CONTENT_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;
  const isProcessing = isSubmitting || uploading;
  const canSubmit =
    (content.trim() || mediaFiles.length > 0) && !isOverLimit && !isProcessing;

  return (
    <form onSubmit={handleSubmit} className={`${isReply ? "ml-8 pl-4" : ""}`}>
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          disabled={isProcessing}
          rows={isReply ? 2 : 3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:bg-surface-secondary disabled:text-text-muted"
        />

        {content.length > MAX_CONTENT_LENGTH * 0.8 && (
          <span
            className={`absolute bottom-2 right-2 text-xs ${
              isOverLimit ? "text-error" : "text-text-muted"
            }`}
          >
            {remainingChars}
          </span>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-error">{error}</p>}

      {/* Media picker: shows previews (if any) + buttons */}
      <div className="mt-2">
        <MediaPicker
          files={mediaFiles}
          onChange={handleMediaChange}
          maxFiles={MAX_MEDIA}
          disabled={isProcessing}
          variant="compact"
          showLabels={false}
        />
      </div>

      {/* Submit buttons */}
      <div className="flex items-center justify-end mt-2 gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit}
          aria-label={isReply ? "Submit reply" : "Submit comment"}
          className="flex items-center gap-1"
        >
          {isProcessing ? (
            <Loader2 aria-hidden="true" size={14} className="animate-spin" />
          ) : (
            <Send aria-hidden="true" size={14} />
          )}
          <span>
            {uploading ? "Uploading..." : isReply ? "Reply" : "Post"}
          </span>
        </Button>
      </div>
    </form>
  );
}
