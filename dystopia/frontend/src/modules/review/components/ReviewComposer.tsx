"use client";

import { useState } from "react";
import { useCreateReview } from "../hooks/useCreateReview";

interface Props {
  targetAccountId: string;
  onCreated?: () => void;
}

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

export function ReviewComposer({ targetAccountId, onCreated }: Props) {
  const { create, loading, error } = useCreateReview();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const entry = await create(targetAccountId, rating, body);
        if (entry) {
          setBody("");
          onCreated?.();
        }
      }}
      className="border-b border-border p-4"
    >
      <label className="block text-sm font-medium">評価</label>
      <select
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="mt-1 rounded border border-border bg-bg px-2 py-1 text-sm"
      >
        {RATING_OPTIONS.map((n) => (
          <option key={n} value={n}>
            ★ {n.toFixed(1)}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-sm font-medium">レビュー (任意、500 文字まで)</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 500))}
        rows={3}
        className="mt-1 block w-full rounded border border-border bg-bg p-2 text-sm"
      />
      <div className="mt-1 text-right text-xs text-muted-foreground">{body.length}/500</div>

      {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-50"
      >
        投稿
      </button>
    </form>
  );
}
