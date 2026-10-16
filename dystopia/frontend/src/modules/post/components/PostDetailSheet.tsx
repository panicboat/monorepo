"use client";

import { SideSheet } from "@/components/ui/side-sheet";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { PostDetailContent } from "./PostDetailContent";

export function PostDetailSheet() {
  const postId = usePostSheetStore((s) => s.postId);
  const session = usePostSheetStore((s) => s.session);
  const open = usePostSheetStore((s) => s.open);
  const close = usePostSheetStore((s) => s.close);

  if (!postId) return null;

  return (
    <SideSheet
      key={session}
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title="投稿の詳細"
    >
      <div className="-mx-4 -mt-4 md:-mx-5">
        <PostDetailContent postId={postId} />
      </div>
    </SideSheet>
  );
}
