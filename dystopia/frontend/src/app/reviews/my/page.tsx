"use client";

import { useProfile } from "@/modules/profile/hooks";
import { ReviewsTab } from "@/modules/review/components/ReviewsTab";

export default function MyReviewsPage() {
  const { profile, loading } = useProfile();

  if (loading) return <div className="p-4 text-sm">読み込み中…</div>;
  if (!profile) return <div className="p-4 text-sm">プロフィールが見つかりませんでした。</div>;

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-medium">レビュー</h1>
      </header>
      <ReviewsTab accountId={profile.accountId} mode="written" />
    </div>
  );
}
