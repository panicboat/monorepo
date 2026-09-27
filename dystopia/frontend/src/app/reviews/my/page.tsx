"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useProfile } from "@/modules/profile/hooks";
import { ReviewsTab } from "@/modules/review/components/ReviewsTab";

export function MyReviewsHeader() {
  return <PageHeader title="レビュー" description="キャストについて書いたレビューの一覧" />;
}

export default function MyReviewsPage() {
  const { profile, loading } = useProfile();

  if (loading) return <div className="p-4 text-sm">読み込み中…</div>;
  if (!profile) return <div className="p-4 text-sm">プロフィールが見つかりませんでした。</div>;

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <MyReviewsHeader />
      </header>
      <ReviewsTab accountId={profile.accountId} mode="written" />
    </div>
  );
}
