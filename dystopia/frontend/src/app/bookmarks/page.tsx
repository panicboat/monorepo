"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useBookmarkList } from "@/modules/bookmarks";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";

export function BookmarksHeader() {
  return <PageHeader title="ブックマーク" description={getFeatureDescription("bookmarks")} />;
}

function HiddenBookmarkRow({ postId, onRemoved }: { postId: string; onRemoved: () => void }) {
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await authFetch(`/api/bookmarks/${encodeURIComponent(postId)}`, { method: "DELETE" });
      onRemoved();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
      <p className="text-sm text-text-secondary">この投稿は表示できません</p>
      <Button variant="secondary" size="sm" onClick={() => void remove()} disabled={removing}>
        ブックマークを外す
      </Button>
    </div>
  );
}

export default function BookmarksPage() {
  const { items, hasMore, loading, error, loadMore, refresh } = useBookmarkList();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <BookmarksHeader />
      </div>

      {loading && items.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && !hasMore && items.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <Bookmark className="size-10 text-text-secondary" strokeWidth={1.5} />
          <p className="pt-3 text-text-primary">まだブックマークがありません</p>
          <p className="pt-1 text-sm text-text-secondary">
            投稿のしおりアイコンから追加できます。
          </p>
        </div>
      )}

      {items.map((item) =>
        item.post ? (
          <PostCardBinding key={item.postId} post={item.post} />
        ) : (
          <HiddenBookmarkRow key={item.postId} postId={item.postId} onRemoved={refresh} />
        )
      )}

      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
    </main>
  );
}
