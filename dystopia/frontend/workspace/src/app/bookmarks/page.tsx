"use client";

import { Button } from "@/components/ui/button";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useBookmarkList } from "@/modules/bookmarks";

export default function BookmarksPage() {
  const { posts, hasMore, loading, error, loadMore } = useBookmarkList();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">ブックマーク</h1>
      </div>

      {loading && posts.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="text-3xl" aria-hidden="true">🔖</span>
          <p className="pt-3 text-text-primary">ブックマークはまだありません</p>
          <p className="pt-1 text-sm text-text-secondary">
            投稿をブックマークすると、ここに表示されます
          </p>
        </div>
      )}

      {posts.map((post) => (
        <PostCardBinding key={post.id} post={post} />
      ))}

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
