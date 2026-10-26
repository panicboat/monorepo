"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { toSavePostMedia } from "@/modules/post/lib/post-media";
import { extractHashtags } from "@/modules/post/lib/hashtags";
import { buildDisplayWindow } from "@/modules/post/lib/display-window";
import { PostComposerAttachments } from "./PostComposerAttachments";
import { useMediaUpload } from "@/modules/media/hooks/useMediaUpload";
import type { UploadedMedia } from "@/modules/media/types";
import { ActingProfileLabel } from "@/modules/profile/components/ActingProfileLabel";
import { useProfile } from "@/modules/profile/hooks";
import { MentionTextarea } from "./MentionTextarea";

const MAX_ATTACHMENTS = 4;

export interface PostComposerProps {
  onSubmit: (payload: SavePostPayload) => Promise<unknown>;
  initialContent?: string;
  initialVisibility?: "public" | "private";
  className?: string;
}

const MAX_LENGTH = 1000;

export function PostComposer({
  onSubmit,
  initialContent = "",
  initialVisibility,
  className,
}: PostComposerProps) {
  const { profile } = useProfile();
  const accountPrivate = !!profile?.isPrivate;
  const [content, setContent] = useState(initialContent);
  const [chosenPrivate, setChosenPrivate] = useState<boolean | null>(
    initialVisibility ? initialVisibility === "private" : null
  );
  const isPrivate = chosenPrivate ?? accountPrivate;
  const [windowEnabled, setWindowEnabled] = useState(false);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
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
          hashtags: extractHashtags(trimmed),
          ...buildDisplayWindow({ enabled: windowEnabled, start: windowStart, end: windowEnd }),
        });
        setContent("");
        setAttachments([]);
        setWindowEnabled(false);
        setWindowStart("");
        setWindowEnd("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "投稿に失敗しました";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, trimmed, isPrivate, attachments, windowEnabled, windowStart, windowEnd, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className={className}>
      <ActingProfileLabel className="mb-2" />
      <MentionTextarea
        value={content}
        onValueChange={setContent}
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
          <Toggle checked={isPrivate} onCheckedChange={setChosenPrivate} aria-label="フォロワーのみ" />
          <span>{isPrivate ? "フォロワーのみ" : "全員"}</span>
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
      <p className="mt-1 text-xs text-text-secondary">{isPrivate ? "あなたとフォロワーだけが見られます" : "誰でも見られます"}</p>
      <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <Toggle checked={windowEnabled} onCheckedChange={setWindowEnabled} aria-label="表示期間を指定" />
        <span>表示期間を指定</span>
      </label>
      {windowEnabled && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-text-secondary">
            <span>表示開始</span>
            <Input
              type="datetime-local"
              aria-label="表示開始"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-text-secondary">
            <span>表示終了</span>
            <Input
              type="datetime-local"
              aria-label="表示終了"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </label>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
