"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { useToastStore } from "@/stores/toastStore";
import { useKarte } from "../hooks/useKarte";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import { formatMonthDay } from "../lib/dates";
import type { Karte, KarteEventInput } from "../types";
import { profileName } from "./KarteCard";
import { KarteEventForm, emptyKarteEvent } from "./KarteEventForm";
import { KarteRatingInput } from "./KarteRatingInput";
import { KarteStatusBadge } from "./KarteStatusBadge";

type Step = { kind: "detail" } | { kind: "append" } | { kind: "edit"; eventId: string };

const TITLES = { detail: "カルテの詳細", append: "カルテに追記", edit: "出来事を編集" } as const;

interface KarteDetailSheetProps {
  karte: Karte;
  open: boolean;
  onClose: () => void;
}

export function KarteDetailSheet({ karte: initial, open, onClose }: KarteDetailSheetProps) {
  const { karte: current, gone } = useKarte(open ? initial.id : null, initial);
  const karte = current ?? initial;
  const { updateRating, close, reopen, addEvent, updateEvent, removeEvent, remove, loading, error } = useKarteMutations();
  const showToast = useToastStore((s) => s.show);
  const [step, setStep] = useState<Step>({ kind: "detail" });
  const [appendDraft, setAppendDraft] = useState<KarteEventInput>(() => emptyKarteEvent());
  const [editDraft, setEditDraft] = useState<KarteEventInput>(() => emptyKarteEvent());

  useEffect(() => {
    if (open && gone) onClose();
  }, [open, gone, onClose]);

  const isOpen = karte.status === "open";
  const editable = karte.isMine && isOpen;
  const guest = { displayName: profileName(karte.targetDisplayName, karte.targetUsername), username: karte.targetUsername, avatarUrl: karte.targetAvatarUrl };
  const confirmed = async (request: () => Promise<unknown>, message: string) => {
    const result = await request();
    if (result) showToast(message);
    return result;
  };

  const startEdit = (eventId: string) => {
    const target = karte.events.find((event) => event.id === eventId);
    if (!target) return;
    setEditDraft({ stage: target.stage, outcome: target.outcome, tags: target.tags, note: target.note, occurredOn: target.occurredOn });
    setStep({ kind: "edit", eventId });
  };

  const body = () => {
    if (step.kind === "append") {
      return (
        <KarteEventForm
          guest={guest}
          value={appendDraft}
          onChange={setAppendDraft}
          submitLabel="この段階を追記"
          submitting={loading}
          error={error?.message ?? null}
          onSubmit={async () => {
            if (!(await confirmed(() => addEvent(karte.id, appendDraft), "カルテに追記しました"))) return;
            setAppendDraft(emptyKarteEvent());
            setStep({ kind: "detail" });
          }}
        />
      );
    }
    if (step.kind === "edit") {
      return (
        <KarteEventForm
          guest={guest}
          value={editDraft}
          onChange={setEditDraft}
          submitLabel="出来事を更新"
          submitting={loading}
          error={error?.message ?? null}
          onSubmit={async () => {
            if (await confirmed(() => updateEvent(step.eventId, editDraft), "出来事を更新しました")) setStep({ kind: "detail" });
          }}
        />
      );
    }
    return (
      <div className="flex flex-col gap-5">
        {error && (
          <p className="text-sm text-error" role="alert">
            {error.message}
          </p>
        )}
        <p className="text-xs font-bold tracking-wide text-text-secondary">KARTE / {isOpen ? "記録中" : "完了"}</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar src={karte.targetAvatarUrl || undefined} fallback={guest.displayName.replace("@", "").slice(0, 1) || "?"} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-bold text-text-primary">{guest.displayName}</p>
              <p className="truncate text-xs text-text-secondary">
                {karte.targetUsername ? `@${karte.targetUsername} · ` : ""}記録者 {profileName(karte.authorDisplayName, karte.authorUsername)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-text-primary">
              {karte.rating === null ? "—" : karte.rating.toFixed(1)} <span className="text-base text-rating">★</span>
            </p>
            <KarteStatusBadge status={karte.status} />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {isOpen ? "記録中のため平均評価には含まれません" : "完了済みの評価は平均に反映されます"}
          </p>
          {editable && (
            <div className="mt-3">
              <KarteRatingInput value={karte.rating} disabled={loading} onChange={(rating) => void updateRating(karte.id, rating)} />
            </div>
          )}
        </div>

        <section>
          <h3 className="mb-3 text-sm font-bold text-text-primary">予約から接客後までの記録</h3>
          <ol className="flex flex-col gap-3">
            {karte.events.map((event) => (
              <li key={event.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-bold text-text-primary">
                  {stageLabel(event.stage)} · {outcomeLabel(event.stage, event.outcome)}
                </p>
                {event.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                        {tagLabel(event.stage, tag)}
                      </span>
                    ))}
                  </div>
                )}
                {event.note && <p className="mt-2 whitespace-pre-wrap text-text-primary">{event.note}</p>}
                <p className="mt-2 text-xs text-text-secondary">発生日 {formatMonthDay(event.occurredOn)}</p>
                {editable && (
                  <div className="mt-2 flex gap-4 text-sm text-text-secondary">
                    <button type="button" onClick={() => startEdit(event.id)} className="hover:text-text-primary">
                      編集
                    </button>
                    <button
                      type="button"
                      disabled={loading || karte.events.length <= 1}
                      onClick={() => {
                        if (!confirm("この出来事を削除しますか？")) return;
                        void confirmed(() => removeEvent(event.id), "出来事を削除しました");
                      }}
                      className="hover:text-text-primary disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {editable && karte.events.length <= 1 && <p className="mt-2 text-xs text-text-secondary">出来事は 1 件以上必要です</p>}
        </section>

        {editable && (
          <Button type="button" variant="secondary" onClick={() => setStep({ kind: "append" })}>
            ＋ 段階を追記する
          </Button>
        )}

        {karte.isMine && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4">
            {isOpen ? (
              <>
                <Button
                  type="button"
                  disabled={loading || karte.rating === null}
                  onClick={() => void confirmed(() => close(karte.id), "カルテを完了しました。平均評価へ反映します")}
                >
                  完了する
                </Button>
                {karte.rating === null && <p className="text-xs text-text-secondary">完了するには星を選んでください</p>}
              </>
            ) : (
              <Button
                type="button"
                disabled={loading}
                onClick={() => void confirmed(() => reopen(karte.id), "カルテを再オープンしました。集計から一時除外します")}
              >
                再オープン
              </Button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                if (!confirm("このカルテを削除しますか？")) return;
                if (!(await remove(karte.id))) return;
                showToast("カルテを削除しました");
                onClose();
              }}
              className="min-h-11 text-sm text-error hover:underline disabled:opacity-50"
            >
              このカルテを削除
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={TITLES[step.kind]}
      onBack={step.kind === "detail" ? undefined : () => setStep({ kind: "detail" })}
      stepKey={step.kind}
    >
      {body()}
    </SideSheet>
  );
}
