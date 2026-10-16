"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SideSheet } from "@/components/ui/side-sheet";
import { SheetNavigationContext } from "@/components/ui/sheetNavigation";
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { PostDetailContent } from "./PostDetailContent";

function CloseOnSearchChange({ open, close }: { open: boolean; close: () => void }) {
  const search = useSearchParams().toString();
  const openedOn = useRef(search);

  useEffect(() => {
    if (!open) openedOn.current = search;
    else if (openedOn.current !== search) close();
  }, [open, search, close]);

  return null;
}

export function PostDetailSheet() {
  const router = useRouter();
  const postId = usePostSheetStore((s) => s.postId);
  const session = usePostSheetStore((s) => s.session);
  const open = usePostSheetStore((s) => s.open);
  const close = usePostSheetStore((s) => s.close);

  // A same-path query change closes via CloseOnSearchChange once it commits; closing here would let history.back() undo the replace.
  const navigate = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.href);
      const sameUrl =
        target.pathname === window.location.pathname &&
        new URLSearchParams(target.search).toString() === new URLSearchParams(window.location.search).toString();
      if (sameUrl) close();
      else router.replace(target.pathname + target.search + target.hash);
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
      <Suspense fallback={null}>
        <CloseOnSearchChange open={open} close={close} />
      </Suspense>
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
