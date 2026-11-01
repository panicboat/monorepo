"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ActingProfileLabel } from "@/modules/profile/components/ActingProfileLabel";

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

const MAX_LENGTH = 5000;

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && !disabled && trimmed.length > 0 && !overLimit;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      try {
        await onSend(trimmed);
        setContent("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "メッセージを送信できませんでした";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, trimmed, onSend]
  );

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-bg px-4 py-3">
      <ActingProfileLabel className="mb-2" />
      <div className="flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="メッセージを入力"
          rows={1}
          disabled={disabled}
          aria-label="メッセージ本文"
          className="max-h-32 min-h-0 min-w-0 flex-1 resize-none rounded-2xl py-1.5 field-sizing-content"
        />
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit} className="h-[38px] shrink-0">
          {submitting ? "送信中…" : "送信"}
        </Button>
      </div>
      {overLimit && (
        <p className="mt-2 text-xs text-error" role="alert">
          {content.length}/{MAX_LENGTH}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
