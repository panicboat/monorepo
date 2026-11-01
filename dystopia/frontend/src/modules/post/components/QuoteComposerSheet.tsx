"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { SideSheet } from "@/components/ui/side-sheet";
import { PostComposer } from "./PostComposer";
import { QuoteFrame } from "./QuoteFrame";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { toQuotedView } from "@/modules/post/lib/post-mappers";
import { usePostFeedStore } from "@/stores/postFeedStore";
import { useQuoteComposeStore } from "@/stores/quoteComposeStore";
import { useToastStore } from "@/stores/toastStore";
import { formatMonthDayTimeInJapan } from "@/lib/utils/japan-date";
import { revalidatePostLists } from "../lib/revalidate";

export function QuoteComposerSheet() {
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);
  const showToast = useToastStore((s) => s.show);
  const post = useQuoteComposeStore((s) => s.post);
  const session = useQuoteComposeStore((s) => s.session);
  const open = useQuoteComposeStore((s) => s.open);
  const close = useQuoteComposeStore((s) => s.close);
  const quotedPostId = post?.id;

  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    await authFetch("/api/posts", { method: "POST", body: { ...payload, quotedPostId } });
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    void revalidatePostLists();
    notifyPostCreated();
    if (payload.publishedAt && new Date(payload.publishedAt) > new Date()) {
      showToast(`予約しました（${formatMonthDayTimeInJapan(payload.publishedAt)} から表示。プロフィールで確認できます）`);
    } else {
      showToast("投稿しました");
    }
    close();
  }, [mutate, notifyPostCreated, showToast, close, quotedPostId]);

  if (!post) return null;

  return (
    <SideSheet
      key={session}
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      title="引用して投稿"
    >
      <PostComposer onSubmit={handleSubmit}>
        <QuoteFrame quoted={toQuotedView(post)} />
      </PostComposer>
    </SideSheet>
  );
}
