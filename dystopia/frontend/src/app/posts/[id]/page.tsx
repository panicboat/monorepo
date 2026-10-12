"use client";

import { useParams } from "next/navigation";
import { PostDetail } from "@/modules/post/components/PostDetail";

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PostDetail postId={typeof id === "string" ? id : ""} />;
}
