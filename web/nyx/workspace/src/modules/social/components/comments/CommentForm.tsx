"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { CommentMedia } from "@/modules/social/types";
import { Button } from "@/components/ui/Button";

const MAX_CONTENT_LENGTH = 1000;

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Comment cannot be empty");
      return;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`Comment must be ${MAX_CONTENT_LENGTH} characters or less`);
      return;
    }

    try {
      await onSubmit(content.trim(), []);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
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

  const remainingChars = MAX_CONTENT_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;

  return (
    <form onSubmit={handleSubmit} className={`${isReply ? "ml-8 pl-4" : ""}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isSubmitting}
          rows={isReply ? 2 : 3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
        />

        {/* Character count */}
        {content.length > MAX_CONTENT_LENGTH * 0.8 && (
          <span
            className={`absolute bottom-2 right-2 text-xs ${
              isOverLimit ? "text-red-500" : "text-slate-400"
            }`}
          >
            {remainingChars}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Actions */}
      <div className="flex items-center justify-end mt-2 gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !content.trim() || isOverLimit}
          className="flex items-center gap-1"
        >
          {isSubmitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          <span>{isReply ? "Reply" : "Post"}</span>
        </Button>
      </div>
    </form>
  );
}
