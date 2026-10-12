"use client";

import { useParams, useRouter } from "next/navigation";
import { SideSheet } from "@/components/ui/side-sheet";
import { PostDetail } from "@/modules/post/components/PostDetail";

export default function DetailPanel() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  return <SideSheet open onOpenChange={(open) => { if (!open) router.back(); }} title="投稿" historyMode="route"><PostDetail postId={id} /></SideSheet>;
}
