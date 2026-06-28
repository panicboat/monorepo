"use client";

import { useState } from "react";
import { useCreateKarte } from "../hooks/useCreateKarte";

interface Props {
  targetAccountId: string;
  onCreated?: () => void;
}

export function KarteComposer({ targetAccountId, onCreated }: Props) {
  const { create, loading, error } = useCreateKarte();
  const [rating, setRating] = useState(3);
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
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)}{"☆".repeat(5 - n)} ({n})
          </option>
        ))}
      </select>

      <label className="mt-3 block text-sm font-medium">メモ (任意、500 文字まで)</label>
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
        保存
      </button>
    </form>
  );
}
