"use client";

import { useReviewSettings } from "@/modules/review/hooks/useReviewSettings";

export default function ReviewSettingsPage() {
  const { reviewsVisible, loading, saving, update } = useReviewSettings();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">レビュー設定</h1>
        <p className="pt-1 text-sm text-text-secondary">
          オフにすると、自分宛のレビューが新規投稿以降も含めて第三者から見えなくなります。
        </p>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      ) : (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-medium">レビューを表示する</span>
          <button
            type="button"
            disabled={saving}
            onClick={() => update(!reviewsVisible)}
            className={`rounded px-3 py-1 text-sm ${
              reviewsVisible ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {reviewsVisible ? "ON" : "OFF"}
          </button>
        </div>
      )}
    </main>
  );
}
