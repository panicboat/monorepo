"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PostDetailContent } from "@/modules/post/components/PostDetailContent";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <Suspense>
        <PostDetail id={id} />
      </Suspense>
    </main>
  );
}

function PostDetail({ id }: { id: string }) {
  const initialTab = useSearchParams()?.get("tab") === "quotes" ? "quotes" : "comments";

  // PostDetailContent reads initialTab only on mount, so key it to follow the URL.
  return <PostDetailContent key={`${id}:${initialTab}`} postId={id} initialTab={initialTab} />;
}
