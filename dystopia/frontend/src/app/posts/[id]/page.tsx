"use client";

import { useParams } from "next/navigation";
import { PostDetailContent } from "@/modules/post/components/PostDetailContent";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <PostDetailContent postId={id} />
    </main>
  );
}
