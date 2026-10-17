"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IdentityLink } from "@/components/ui/identity-link";
import { RatingStars } from "@/components/ui/rating-stars";
import { formatTimeAgo } from "@/lib/utils/date";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import type { Karte } from "../types";
import { KarteEventFields, emptyKarteEvent, isKarteEventReady } from "./KarteEventFields";
import { KarteRatingSelect } from "./KarteRatingSelect";

interface KarteEntryCardProps {
  karte: Karte;
  mode: "my" | "target" | "recent";
  onChanged?: () => void;
}

export function KarteEntryCard({ karte, mode, onChanged }: KarteEntryCardProps) {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const { updateRating, close, reopen, addEvent, remove, loading, error } = useKarteMutations();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(() => emptyKarteEvent());
  const writtenAsOtherProfile = mode === "my" && karte.authorProfileId !== activeProfileId;
  const identityUsername = mode === "my" ? karte.targetUsername : karte.authorUsername;
  const identityAvatarUrl = mode === "my" ? karte.targetAvatarUrl : karte.authorAvatarUrl;
  const latest = karte.events[karte.events.length - 1];
  const open = karte.status === "open";
  const afterChange = () => onChanged?.();

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {mode === "recent" ? (
          <>
            <IdentityLink username={karte.authorUsername} avatarUrl={karte.authorAvatarUrl} />
            <span className="text-text-secondary">→</span>
            <IdentityLink username={karte.targetUsername} avatarUrl={karte.targetAvatarUrl} />
          </>
        ) : (
          <IdentityLink username={identityUsername} avatarUrl={identityAvatarUrl} />
        )}
        <span className="text-text-secondary">{formatTimeAgo(karte.createdAt)}</span>
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
          {open ? "記録中" : "完了"}
        </span>
      </div>
      {writtenAsOtherProfile && (
        <p className="mt-1 text-xs text-text-secondary">
          {karte.authorUsername ? `@${karte.authorUsername} として記録` : "削除したプロフィールで記録"}
        </p>
      )}
      <div className="mt-1">
        {karte.rating === null ? (
          <span className="text-sm text-text-secondary">未評価</span>
        ) : (
          <RatingStars value={karte.rating} className="text-base" />
        )}
      </div>
      {latest && (
        <div className="mt-2 text-sm">
          <p className="font-bold">
            {stageLabel(latest.stage)}・{outcomeLabel(latest.stage, latest.outcome)}
          </p>
          {latest.tags.length > 0 && (
            <p className="text-xs text-text-secondary">{latest.tags.map((tag) => tagLabel(latest.stage, tag)).join("・")}</p>
          )}
          {latest.note && <p className="mt-1 whitespace-pre-wrap">{latest.note}</p>}
        </div>
      )}
      {karte.events.length > 1 && <p className="mt-1 text-xs text-text-secondary">ほか {karte.events.length - 1} 件の出来事</p>}
      {karte.isMine && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {open && (
            <KarteRatingSelect
              value={karte.rating}
              disabled={loading}
              onChange={async (rating) => {
                await updateRating(karte.id, rating);
                afterChange();
              }}
            />
          )}
          {open && adding && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const added = await addEvent(karte.id, draft);
                if (added) {
                  setAdding(false);
                  setDraft(emptyKarteEvent());
                }
                afterChange();
              }}
              className="flex flex-col gap-2"
            >
              <KarteEventFields value={draft} onChange={setDraft} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading || !isKarteEventReady(draft)}>
                  追記する
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(false)}>
                  やめる
                </Button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
            {open && !adding && (
              <button type="button" onClick={() => setAdding(true)} className="hover:text-text-primary">
                出来事を追加
              </button>
            )}
            {open && (
              <button
                type="button"
                disabled={loading || karte.rating === null}
                onClick={async () => {
                  await close(karte.id);
                  afterChange();
                }}
                className="hover:text-text-primary disabled:opacity-50"
              >
                完了する
              </button>
            )}
            {!open && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  await reopen(karte.id);
                  afterChange();
                }}
                className="hover:text-text-primary"
              >
                再オープン
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                if (!confirm("このカルテを削除しますか？")) return;
                await remove(karte.id);
                afterChange();
              }}
              className="hover:text-text-primary"
            >
              削除
            </button>
          </div>
          {open && karte.rating === null && <p className="text-xs text-text-secondary">完了するには星を選んでください</p>}
          {error && (
            <p className="text-xs text-error" role="alert">
              {error.message}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
