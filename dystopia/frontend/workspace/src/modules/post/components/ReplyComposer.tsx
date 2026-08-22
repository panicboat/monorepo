"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddComment } from "@/modules/post/hooks/useAddComment";

interface ReplyComposerProps {
  postId: string;
  parentId: string;
  onCancel: () => void;
  onSubmitted: () => void;
}

const MAX_LENGTH = 1000;

export function ReplyComposer({ postId, parentId, onCancel, onSubmitted }: ReplyComposerProps) {
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
        await addComment(content, parentId);
        setContent("");
        onSubmitted();
      } catch {
        // error は hook 内 state、UI で表示
      }
    },
    [canSubmit, content, parentId, addComment, onSubmitted]
  );

  return (
    <form onSubmit={handleSubmit} className="border-b border-divider py-3 pl-12 pr-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="返信を書く"
        rows={2}
        aria-label="返信内容"
        autoFocus
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          className={`text-xs ${overLimit ? "text-error" : "text-text-muted"}`}
          aria-live="polite"
        >
          {content.length}/{MAX_LENGTH}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
            {submitting ? "送信中…" : "返信"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          返信送信に失敗しました
        </p>
      )}
    </form>
  );
}
