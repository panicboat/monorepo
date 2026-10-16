"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { SideSheet } from "@/components/ui/side-sheet";
import { SheetNavigationContext } from "@/components/ui/sheetNavigation";
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { PostDetailContent } from "./PostDetailContent";

export function PostDetailSheet() {
  const router = useRouter();
  const postId = usePostSheetStore((s) => s.postId);
  const session = usePostSheetStore((s) => s.session);
  const open = usePostSheetStore((s) => s.open);
  const close = usePostSheetStore((s) => s.close);

  // The sheet closes on a pathname change, so it is closed here when the target keeps the current pathname.
  const navigate = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.href);
      const samePath = target.pathname === window.location.pathname;
      if (!samePath || target.search !== window.location.search) router.replace(target.pathname + target.search + target.hash);
      if (samePath) close();
    },
    [close, router]
  );

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
      <SheetNavigationContext.Provider value={navigate}>
        <div
          className="-mx-4 -mt-4 md:-mx-5"
          onClickCapture={(e) => {
            if (!isPlainClick(e)) return;
            const anchor = (e.target as Element).closest("a[href]");
            if (!anchor) return;
            const href = anchor.getAttribute("href") ?? "";
            if (new URL(href, window.location.href).origin !== window.location.origin) return;
            e.preventDefault();
            e.stopPropagation();
            navigate(href);
          }}
        >
          <PostDetailContent postId={postId} />
        </div>
      </SheetNavigationContext.Provider>
    </SideSheet>
  );
}
