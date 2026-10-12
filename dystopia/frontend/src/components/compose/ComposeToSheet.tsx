"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { SideSheet } from "@/components/ui/side-sheet";
import { KarteComposer } from "@/modules/karte/components/KarteComposer";
import { ReviewComposer } from "@/modules/review/components/ReviewComposer";
import { useStartChat } from "@/modules/messaging/hooks/useStartChat";
import type { SocialProfileView } from "@/modules/social/types";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { RecipientPicker } from "./RecipientPicker";
import { resolveRecipientSource, type RecipientKind } from "./resolveRecipientSource";

const COMPOSE_TITLE = { karte: "カルテを書く", review: "レビューを書く" } as const;
const SAVED_MESSAGE = { karte: "カルテを保存しました", review: "レビューを投稿しました" } as const;

interface ComposeToSheetProps {
  kind: RecipientKind;
  open: boolean;
  onClose: () => void;
}

export function ComposeToSheet({ kind, open, onClose }: ComposeToSheetProps) {
  const viewerRole = useAuthStore(selectRole);
  const showToast = useToastStore((s) => s.show);
  const { start, loading: opening } = useStartChat();
  const pathname = usePathname();
  const [target, setTarget] = useState<SocialProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const source = resolveRecipientSource(kind, viewerRole);
  const composeKind = target && kind !== "message" ? kind : null;

  const pick = async (profile: SocialProfileView) => {
    setError(null);
    if (kind !== "message") return setTarget(profile);
    try {
      // The route change closes the sheet, so close here only when the conversation is already the current page.
      if ((await start(profile.profileId, { replace: true })) === pathname) onClose();
    } catch (e) {
      // FALLBACK: Use a generic message when the failure carries none.
      setError(e instanceof Error && e.message ? e.message : "メッセージを始められませんでした");
    }
  };

  const saved = () => {
    if (kind !== "message") showToast(SAVED_MESSAGE[kind]);
    onClose();
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={composeKind ? COMPOSE_TITLE[composeKind] : source.title}
      onBack={composeKind ? () => setTarget(null) : undefined}
      stepKey={composeKind ? "compose" : "pick"}
    >
      {error && (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {!target && (
        <div className={opening ? "pointer-events-none opacity-60" : undefined}>
          <RecipientPicker source={source} onPick={pick} />
        </div>
      )}

      {target && composeKind && (
        <>
          <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
            <Avatar src={target.avatarUrl || undefined} fallback={target.displayName.slice(0, 1) || "?"} size="sm" />
            <span className="min-w-0 truncate text-sm font-bold text-text-primary">{target.displayName}</span>
            <span className="truncate text-xs text-text-secondary">@{target.username}</span>
          </div>
          {composeKind === "karte" ? (
            <KarteComposer targetProfileId={target.profileId} onCreated={saved} />
          ) : (
            <ReviewComposer targetProfileId={target.profileId} onCreated={saved} />
          )}
        </>
      )}
    </SideSheet>
  );
}
