"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { toSavePostMedia } from "@/modules/post/lib/post-media";
import { PostComposerAttachments } from "./PostComposerAttachments";
import { useMediaUpload } from "@/modules/media/hooks/useMediaUpload";
import type { UploadedMedia } from "@/modules/media/types";

const MAX_ATTACHMENTS = 4;

export interface PostComposerProps {
  /** Called on submit with the form payload. Throws to surface an error to the user. */
  onSubmit: (payload: SavePostPayload) => Promise<unknown>;
  /** Optional initial content (for edit reuse later). */
  initialContent?: string;
  /** Optional initial visibility. Defaults to "public". */
  initialVisibility?: "public" | "private";
  className?: string;
}

const MAX_LENGTH = 1000;

export function PostComposer({
  onSubmit,
  initialContent = "",
  initialVisibility = "public",
  className,
}: PostComposerProps) {
  const [content, setContent] = useState(initialContent);
  const [isPrivate, setIsPrivate] = useState(initialVisibility === "private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<UploadedMedia[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMedia } = useMediaUpload();

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && !isUploadingFiles && trimmed.length > 0 && !overLimit;
  const canAttachMore = attachments.length < MAX_ATTACHMENTS;

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).slice(
        0,
        MAX_ATTACHMENTS - attachments.length
      );
      e.target.value = "";
      if (files.length === 0) return;

      setError(null);
      setIsUploadingFiles(true);
      try {
        const uploaded = await Promise.all(
          files.map((file) => uploadMedia(file, { registerAfterUpload: true }))
        );
        setAttachments((prev) => [...prev, ...uploaded]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "アップロードに失敗しました";
        setError(message);
      } finally {
        setIsUploadingFiles(false);
      }
    },
    [attachments.length, uploadMedia]
  );

  const handleRemoveAttachment = useCallback((mediaId: string) => {
    setAttachments((prev) => prev.filter((item) => item.mediaId !== mediaId));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit({
          content: trimmed,
          visibility: isPrivate ? "private" : "public",
          media: toSavePostMedia(attachments),
        });
        setContent("");
        setAttachments([]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "投稿に失敗しました";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, trimmed, isPrivate, attachments, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className={className}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={4}
        aria-label="投稿内容"
      />
      <PostComposerAttachments
        items={attachments}
        onRemove={handleRemoveAttachment}
        disabled={submitting}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting || isUploadingFiles || !canAttachMore}
        >
          {isUploadingFiles ? "アップロード中…" : "画像/動画を追加"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-label="画像や動画を選択"
          onChange={handleFilesSelected}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <Toggle checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="非公開投稿" />
          <span>{isPrivate ? "非公開" : "公開"}</span>
        </label>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${overLimit ? "text-error" : "text-text-muted"}`}
            aria-live="polite"
          >
            {content.length}/{MAX_LENGTH}
          </span>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {submitting ? "投稿中…" : "投稿する"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
