"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

const MAX_LENGTH = 5000;

export function MessageComposer({ onSend, onTyping, disabled }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && !disabled && trimmed.length > 0 && !overLimit;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (onTyping) onTyping();
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      try {
        await onSend(trimmed);
        setContent("");
      } catch {
        // SILENT: error は呼び出し側で expose、本 form は state 内回収しない
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, trimmed, onSend]
  );

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-bg px-4 py-3">
      <Textarea
        value={content}
        onChange={handleChange}
        placeholder="メッセージを入力"
        rows={2}
        disabled={disabled}
        aria-label="メッセージ本文"
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
    </form>
  );
}
