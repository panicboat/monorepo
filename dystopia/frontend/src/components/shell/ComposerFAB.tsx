"use client";

import { useState } from "react";
import { PostComposerModal } from "@/modules/post/components/PostComposerModal";

export function ComposerFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-2xl text-white shadow-brand-glow active:scale-95 md:hidden"
        aria-label="投稿を作成"
      >
        ＋
      </button>
      <PostComposerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
