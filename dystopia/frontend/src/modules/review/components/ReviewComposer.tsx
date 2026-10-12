"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RatingInput } from "@/components/ui/rating-input";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { useCreateReview } from "../hooks/useCreateReview";

interface Props {
  targetProfileId: string;
  onCreated?: () => void;
}

export function ReviewComposer({ targetProfileId, onCreated }: Props) {
  const { capture } = useViewScope(true, targetProfileId);
  const { create, loading, error } = useCreateReview();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const request = capture();
        const entry = await create(targetProfileId, rating, body);
        if (entry && request.isCurrent()) {
          setBody("");
          onCreated?.();
        }
      }}
      className="space-y-5 py-5"
    >
      <div><p className="text-sm font-bold">評価（必須）</p><RatingInput value={rating} onChange={(value) => { if (value !== null) setRating(value); }} allowUnrated={false} disabled={loading} /></div>
      <label className="mt-3 block text-sm font-medium">レビュー (任意、500 文字まで)</label>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 500))}
        rows={3}
        className="mt-2"
      />
      <div className="mt-1 text-right text-xs text-text-secondary">{body.length}/500</div>

      {error && <p className="mt-2 text-sm text-error">{error.message}</p>}

      <Button type="submit" disabled={loading} className="w-full">{loading ? "投稿中…" : "レビューを投稿"}</Button>
    </form>
  );
}
