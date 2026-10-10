"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Avatar } from "@/components/ui/avatar";
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

interface ComposeToDialogProps {
  kind: RecipientKind;
  onClose: () => void;
}

export function ComposeToDialog({ kind, onClose }: ComposeToDialogProps) {
  const viewerRole = useAuthStore(selectRole);
  const showToast = useToastStore((s) => s.show);
  const { start, loading: opening } = useStartChat();
  const [target, setTarget] = useState<SocialProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const source = resolveRecipientSource(kind, viewerRole);

  const pick = async (profile: SocialProfileView) => {
    setError(null);
    if (kind !== "message") return setTarget(profile);
    try {
      await start(profile.profileId);
      onClose();
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
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center gap-2">
            {target && (
              <button
                type="button"
                onClick={() => setTarget(null)}
                aria-label="宛先を選び直す"
                className="rounded-full p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              >
                ←
              </button>
            )}
            <Dialog.Title className="flex-1 text-lg font-bold text-text-primary">
              {target && kind !== "message" ? COMPOSE_TITLE[kind] : source.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="閉じる"
                className="rounded-full p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

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

          {target && kind !== "message" && (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
                <Avatar src={target.avatarUrl || undefined} fallback={target.displayName.slice(0, 1) || "?"} size="sm" />
                <span className="min-w-0 truncate text-sm font-bold text-text-primary">{target.displayName}</span>
                <span className="truncate text-xs text-text-secondary">@{target.username}</span>
              </div>
              {kind === "karte" ? (
                <KarteComposer targetProfileId={target.profileId} onCreated={saved} />
              ) : (
                <ReviewComposer targetProfileId={target.profileId} onCreated={saved} />
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
