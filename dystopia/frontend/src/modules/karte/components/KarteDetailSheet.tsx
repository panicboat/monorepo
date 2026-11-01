"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { ReportButton } from "@/modules/report";
import { MISSING_CAST, MISSING_GUEST, ProfileName, profileInitial } from "@/components/ui/profile-name";
import { formatMonthDay } from "@/lib/utils/japan-date";
import { useToastStore } from "@/stores/toastStore";
import { useKarte } from "../hooks/useKarte";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import type { Karte, KarteEventInput } from "../types";
import { KarteEventForm, emptyKarteEvent } from "./KarteEventForm";
import { StarRatingInput } from "@/components/ui/star-rating-input";

type Step = { kind: "detail" } | { kind: "append" } | { kind: "edit"; eventId: string };

const TITLES = { detail: "カルテの詳細", append: "カルテに追記", edit: "出来事を編集" } as const;

interface KarteDetailSheetProps {
  karte: Karte;
  open: boolean;
  onClose: () => void;
}

export function KarteDetailSheet({ karte: initial, open, onClose }: KarteDetailSheetProps) {
  const [deleting, setDeleting] = useState(false);
  const { karte: current, gone, apply } = useKarte(open && !deleting ? initial.id : null, initial);
  const karte = current ?? initial;
  const { updateRating, addEvent, updateEvent, removeEvent, remove, loading, error } = useKarteMutations();
  const showToast = useToastStore((s) => s.show);
  const [step, setStep] = useState<Step>({ kind: "detail" });
  const [appendDraft, setAppendDraft] = useState<KarteEventInput>(() => emptyKarteEvent());
  const [editDraft, setEditDraft] = useState<KarteEventInput>(() => emptyKarteEvent());

  useEffect(() => {
    if (open && gone) onClose();
  }, [open, gone, onClose]);

  const confirmed = async (request: () => Promise<Karte | null>, message?: string) => {
    const result = await request();
    if (result) {
      apply(result);
      if (message) showToast(message);
    }
    return result;
  };

  const deleteEvent = async (eventId: string) => {
    const last = karte.events.length <= 1;
    if (!confirm(last ? "最後の出来事を削除すると、カルテも削除されます。よろしいですか？" : "この出来事を削除しますか？")) return;
    // Stop reading the karte before the server may delete it, as the whole-karte deletion does.
    if (last) setDeleting(true);
    const result = await removeEvent(eventId);
    if (!result) {
      setDeleting(false);
      return;
    }
    if (!result.karte) {
      showToast("カルテを削除しました");
      onClose();
      return;
    }
    apply(result.karte);
    showToast("出来事を削除しました");
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
          guest={karte.target}
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
          guest={karte.target}
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
        <p className="text-xs font-bold tracking-wide text-text-secondary">KARTE</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar src={karte.target?.avatarUrl || undefined} fallback={profileInitial(karte.target)} size="sm" />
            <div className="min-w-0">
              <p className="truncate"><ProfileName profile={karte.target} missing={MISSING_GUEST} /></p>
              <p className="truncate text-xs text-text-secondary">
                {karte.target?.username ? `@${karte.target?.username} · ` : ""}記録者 <ProfileName profile={karte.author} className="font-normal" missing={MISSING_CAST} />
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-text-primary">
              {karte.rating === null ? "—" : karte.rating.toFixed(1)} <span className="text-base text-rating">★</span>
            </p>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {karte.rating === null ? "星を付けると平均評価に反映されます" : "平均評価に反映されています"}
          </p>
          {karte.isMine && (
            <div className="mt-3">
              <StarRatingInput label="予約・接客の信頼性" value={karte.rating} disabled={loading} onChange={(rating) => void confirmed(() => updateRating(karte.id, rating))} />
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
                {karte.isMine && (
                  <div className="mt-2 flex gap-4 text-sm text-text-secondary">
                    <button type="button" onClick={() => startEdit(event.id)} className="hover:text-text-primary">
                      編集
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void deleteEvent(event.id)}
                      className="hover:text-text-primary disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>

        {karte.isMine && (
          <Button type="button" variant="secondary" onClick={() => setStep({ kind: "append" })}>
            ＋ 段階を追記する
          </Button>
        )}

        {karte.isMine && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                if (!confirm("このカルテを削除しますか？出来事もすべて削除されます。")) return;
                setDeleting(true);
                if (!(await remove(karte.id))) {
                  setDeleting(false);
                  return;
                }
                showToast("カルテを削除しました");
                onClose();
              }}
              className="min-h-11 text-sm text-error hover:underline disabled:opacity-50"
            >
              このカルテを削除
            </button>
          </div>
        )}

        {!karte.isMine && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4">
            <ReportButton targetType="karte" targetId={karte.id} label="このカルテを通報" className="min-h-11 text-sm text-text-secondary hover:underline" />
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
