"use client";

import { useState } from "react";

const WHOLE_RATINGS = [1, 2, 3, 4, 5];
const MAX_BODY_LENGTH = 500;

export interface EntryEditFormProps {
  initialRating: number;
  initialBody: string;
  saving: boolean;
  error?: string;
  onSave: (rating: number, body: string) => void;
  onCancel: () => void;
}

function ratingLabel(rating: number): string {
  if (!Number.isInteger(rating)) return `★ ${rating.toFixed(1)}`;
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating})`;
}

export function EntryEditForm({ initialRating, initialBody, saving, error, onSave, onCancel }: EntryEditFormProps) {
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  // Keep a stored rating between two whole values selectable: saving the body alone must not round it.
  const ratings = WHOLE_RATINGS.includes(initialRating)
    ? WHOLE_RATINGS
    : [...WHOLE_RATINGS, initialRating].sort((a, b) => a - b);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(rating, body);
      }}
      className="mt-2"
    >
      <select
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        aria-label="評価"
        className="rounded border border-border bg-bg px-2 py-1 text-sm"
      >
        {ratings.map((n) => (
          <option key={n} value={n}>
            {ratingLabel(n)}
          </option>
        ))}
      </select>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
        rows={3}
        aria-label="本文"
        className="mt-2 block w-full rounded border border-border bg-bg p-2 text-sm"
      />
      <div className="mt-1 text-right text-xs text-muted-foreground">
        {body.length}/{MAX_BODY_LENGTH}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex gap-3 text-sm">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:opacity-50"
        >
          保存
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="text-muted-foreground hover:text-foreground">
          キャンセル
        </button>
      </div>
    </form>
  );
}
