"use client";

import { Button } from "@/components/ui/button";
import { usePost } from "../hooks/usePost";
import { PostCardBinding } from "./PostCardBinding";
import { CommentList } from "./CommentList";
import { CommentComposer } from "./CommentComposer";

export function PostDetail({ postId }: { postId: string }) {
  const { post, loading, error, mutate } = usePost(postId || null);
  if (loading) return <main className="p-6 text-text-secondary">読み込み中…</main>;
  if (error) return <main role="alert" className="p-6 text-text-secondary">投稿を取得できませんでした。<Button variant="secondary" onClick={() => void mutate(undefined, { throwOnError: false, populateCache: false })}>再試行</Button></main>;
  if (!post) return <main className="p-6 text-text-secondary">投稿が見つかりませんでした。</main>;
  return (
    <main className="mx-auto max-w-xl bg-surface pb-10 text-text-primary">
      <PostCardBinding post={post} />
      <section className="border-t border-divider">
        <h2 className="px-4 py-3 text-sm font-bold text-text-secondary">コメント（{post.commentsCount} 件）</h2>
        <CommentComposer key={post.id} postId={post.id} />
        <CommentList postId={post.id} />
      </section>
    </main>
  );
}
