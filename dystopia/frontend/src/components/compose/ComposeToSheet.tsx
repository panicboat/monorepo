"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SideSheet } from "@/components/ui/side-sheet";
import { emptyKarteEvent } from "@/modules/karte/components/KarteEventForm";
import { KarteCreateForm } from "@/modules/karte/components/KarteCreateForm";
import { emptyReviewEvent } from "@/modules/review/components/ReviewEventForm";
import { ReviewCreateForm } from "@/modules/review/components/ReviewCreateForm";
import { useStartChat } from "@/modules/messaging/hooks/useStartChat";
import type { KarteEventInput } from "@/modules/karte/types";
import type { ReviewEventInput } from "@/modules/review/types";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { RecipientPicker } from "./RecipientPicker";
import { resolveRecipientSource, type RecipientKind } from "./resolveRecipientSource";

const COMPOSE_TITLE = { karte: "カルテを書く", review: "クチコミを書く" } as const;
const SAVED_MESSAGE = { karte: "記録中のカルテを作成しました", review: "記録中のクチコミを作成しました" } as const;

interface ComposeToSheetProps {
  kind: RecipientKind;
  open: boolean;
  onClose: () => void;
  initialTarget?: ProfileSummaryView;
  onSaved?: () => void;
}

export function ComposeToSheet({ kind, open, onClose, initialTarget, onSaved }: ComposeToSheetProps) {
  const viewerRole = useAuthStore(selectRole);
  const showToast = useToastStore((s) => s.show);
  const { start, loading: opening } = useStartChat();
  const pathname = usePathname();
  const [target, setTarget] = useState<ProfileSummaryView | null>(initialTarget ?? null);
  const [error, setError] = useState<string | null>(null);
  const [karteEvent, setKarteEvent] = useState<KarteEventInput>(() => emptyKarteEvent());
  const [karteRating, setKarteRating] = useState<number | null>(null);
  const [reviewEvent, setReviewEvent] = useState<ReviewEventInput>(() => emptyReviewEvent());
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const startedOn = useRef(pathname);
  const source = resolveRecipientSource(kind, viewerRole);
  const composeKind = target && kind !== "message" ? kind : null;

  const pick = async (profile: ProfileSummaryView) => {
    setError(null);
    if (kind !== "message") return setTarget(profile);
    if (starting) return;
    startedOn.current = pathname;
    setStarting(true);
    try {
      // The route change closes the sheet, so close here only when the conversation is already the current page.
      if ((await start(profile.profileId, { replace: true })) === pathname) onClose();
    } catch (e) {
      setStarting(false);
      // FALLBACK: Use a generic message when the failure carries none.
      setError(e instanceof Error && e.message ? e.message : "メッセージを始められませんでした");
    }
  };

  // Stay open until the route changes while a conversation is opening: closing first would pop the history entry the navigation is about to replace.
  const requestClose = () => {
    if (starting && pathname === startedOn.current) return;
    onClose();
  };

  const saved = () => {
    if (kind !== "message") showToast(SAVED_MESSAGE[kind]);
    onSaved?.();
    onClose();
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => { if (!next) requestClose(); }}
      title={composeKind ? COMPOSE_TITLE[composeKind] : source.title}
      onBack={composeKind && !initialTarget ? () => setTarget(null) : undefined}
      stepKey={composeKind ? "compose" : "pick"}
    >
      {error && (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {!target && (
        <div className={opening || starting ? "pointer-events-none opacity-60" : undefined}>
          <RecipientPicker source={source} onPick={pick} />
        </div>
      )}

      {target && composeKind === "karte" && (
        <KarteCreateForm
          target={target}
          event={karteEvent}
          onEventChange={setKarteEvent}
          rating={karteRating}
          onRatingChange={setKarteRating}
          onCreated={saved}
        />
      )}

      {target && composeKind === "review" && (
        <ReviewCreateForm
          target={target}
          event={reviewEvent}
          onEventChange={setReviewEvent}
          rating={reviewRating}
          onRatingChange={setReviewRating}
          onCreated={saved}
        />
      )}
    </SideSheet>
  );
}
