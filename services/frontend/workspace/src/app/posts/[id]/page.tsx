"use client";

import { useParams } from "next/navigation";
import { usePost } from "@/modules/post/hooks/usePost";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { post, loading, error } = usePost(id || null);

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !post) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">投稿が見つかりませんでした。</main>;
  }

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <PostCardBinding post={post} />
      <p className="px-4 py-6 text-sm text-text-muted">
        コメント（{post.commentsCount} 件）の表示はコメントスライス UI 更新後に対応。
      </p>
    </main>
  );
}
