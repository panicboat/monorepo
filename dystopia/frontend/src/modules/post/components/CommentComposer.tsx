"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAddComment } from "@/modules/post/hooks/useAddComment";
import { ActingProfileLabel } from "@/modules/profile/components/ActingProfileLabel";
import { MentionTextarea } from "./MentionTextarea";

interface CommentComposerProps {
  postId: string;
  focusRequest?: number;
}

const MAX_LENGTH = 1000;

export function CommentComposer({ postId, focusRequest = 0 }: CommentComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState("");
  const { addComment, submitting, error } = useAddComment(postId);

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && trimmed.length > 0 && !overLimit;

  useEffect(() => {
    if (focusRequest > 0) formRef.current?.querySelector("textarea")?.focus();
  }, [focusRequest]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      try {
        await addComment(content);
        setContent("");
      } catch {
        // SILENT: useAddComment exposes submission failures through the hook state.
      }
    },
    [canSubmit, content, addComment]
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="border-b border-divider px-4 py-3">
      <ActingProfileLabel className="mb-2" />
      <MentionTextarea
        value={content}
        onValueChange={setContent}
        placeholder="コメントを書く"
        rows={2}
        aria-label="コメント内容"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          className={`text-xs ${overLimit ? "text-error" : "text-text-muted"}`}
          aria-live="polite"
        >
          {content.length}/{MAX_LENGTH}
        </span>
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
          {submitting ? "送信中…" : "送信"}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          コメント送信に失敗しました
        </p>
      )}
    </form>
  );
}
