"use client";

import { usePostDeletionStore } from "@/stores/postDeletionStore";
import { usePost } from "../hooks/usePost";
import { CommentComposer } from "./CommentComposer";
import { CommentList } from "./CommentList";
import { PostCardBinding } from "./PostCardBinding";

export function PostDetailContent({ postId }: { postId: string }) {
  const { post, loading, error } = usePost(postId || null);
  const deleted = usePostDeletionStore((s) => !!s.deleted[postId]);

  if (loading) {
    return <p className="p-6 text-text-secondary">読み込み中…</p>;
  }
  if (error || !post || deleted) {
    return <p className="p-6 text-text-secondary">投稿が見つかりませんでした。</p>;
  }

  return (
    <>
      <PostCardBinding post={post} inDetail />
      <section className="border-t border-divider">
        <h2 className="px-4 py-3 text-sm font-bold text-text-secondary">コメント（{post.commentsCount} 件）</h2>
        <CommentComposer postId={post.id} />
        <CommentList postId={post.id} />
      </section>
    </>
  );
}
