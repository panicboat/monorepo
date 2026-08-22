"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddComment } from "@/modules/post/hooks/useAddComment";

interface CommentComposerProps {
  postId: string;
}

const MAX_LENGTH = 1000;

export function CommentComposer({ postId }: CommentComposerProps) {
  const [content, setContent] = useState("");
  const { addComment, submitting, error } = useAddComment(postId);

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && trimmed.length > 0 && !overLimit;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      try {
        await addComment(content);
        setContent("");
      } catch {
        // error は hook 内 state に立つ、UI で表示
      }
    },
    [canSubmit, content, addComment]
  );

  return (
    <form onSubmit={handleSubmit} className="border-b border-divider px-4 py-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
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
