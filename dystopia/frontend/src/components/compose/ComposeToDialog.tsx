"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { SideSheet } from "@/components/ui/side-sheet";
import { RouteFade } from "@/lib/motion/RouteFade";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { KarteComposer } from "@/modules/karte/components/KarteComposer";
import { ReviewComposer } from "@/modules/review/components/ReviewComposer";
import { MessageDraft } from "@/modules/messaging/components/MessageDraft";
import type { SocialProfileView } from "@/modules/social/types";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { RecipientPicker } from "./RecipientPicker";
import { resolveRecipientSource, type RecipientKind } from "./resolveRecipientSource";

const COMPOSE_TITLE = { karte: "カルテを書く", review: "レビューを書く", message: "メッセージを作成" } as const;
const SAVED_MESSAGE = { karte: "カルテを保存しました", review: "レビューを投稿しました" } as const;
interface ComposeToDialogProps { kind: RecipientKind; onClose: () => void; open?: boolean; }

export function ComposeToDialog({ kind, onClose, open = true }: ComposeToDialogProps) {
  const viewerRole = useAuthStore(selectRole);
  const showToast = useToastStore((state) => state.show);
  const router = useRouter();
  const pathname = usePathname();
  const scope = useViewScope(open, kind);
  const [target, setTarget] = useState<SocialProfileView | null>(null);
  const [session, setSession] = useState({ open, kind, pathname });
  if (session.open !== open || session.kind !== kind) {
    setSession({ open, kind, pathname: open ? pathname : session.pathname });
    if (open) setTarget(null);
  }
  useEffect(() => { if (open && pathname !== session.pathname) onClose(); }, [open, pathname, session.pathname, onClose]);
  const source = resolveRecipientSource(kind, viewerRole);
  const saved = () => { if (!scope.capture().isCurrent()) return; if (kind !== "message") showToast(SAVED_MESSAGE[kind]); onClose(); };

  return <SideSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={target ? COMPOSE_TITLE[kind] : source.title} onBack={target ? () => setTarget(null) : undefined}>
    <RouteFade transitionKey={`${kind}:${target?.profileId || "picker"}`}>
      <div key={scope.scopeId}>
        {!target ? <RecipientPicker source={source} onPick={setTarget} /> : <>
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-divider bg-bg/40 px-3 py-3"><Avatar src={target.avatarUrl || undefined} fallback={target.displayName.slice(0, 1) || "?"} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-bold">{target.displayName}</p><p className="truncate text-xs text-text-secondary">@{target.username}</p></div></div>
          {kind === "karte" ? <KarteComposer targetProfileId={target.profileId} onCreated={saved} /> : kind === "review" ? <ReviewComposer targetProfileId={target.profileId} onCreated={saved} /> : <MessageDraft recipientProfileId={target.profileId} onSent={(threadId) => { if (scope.capture().isCurrent()) router.replace(`/messages/${encodeURIComponent(threadId)}`); }} />}
        </>}
      </div>
    </RouteFade>
  </SideSheet>;
}
