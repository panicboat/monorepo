"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { StarRatingInput } from "@/components/ui/star-rating-input";
import { HIDDEN_GUEST, MISSING_CAST, MISSING_GUEST, ProfileName, profileInitial } from "@/components/ui/profile-name";
import { formatMonthDay } from "@/lib/utils/japan-date";
import { useToastStore } from "@/stores/toastStore";
import { useReview } from "../hooks/useReview";
import { useReviewMutations } from "../hooks/useReviewMutations";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import type { Review, ReviewEventInput } from "../types";
import { ReviewEventForm, emptyReviewEvent } from "./ReviewEventForm";

type Step = { kind: "detail" } | { kind: "append" } | { kind: "edit"; eventId: string };

const TITLES = { detail: "クチコミの詳細", append: "クチコミに追記", edit: "出来事を編集" } as const;

interface ReviewDetailSheetProps {
  review: Review;
  open: boolean;
  onClose: () => void;
}

export function ReviewDetailSheet({ review: initial, open, onClose }: ReviewDetailSheetProps) {
  const [deleting, setDeleting] = useState(false);
  const { review: current, gone, apply } = useReview(open && !deleting ? initial.id : null, initial);
  const review = current ?? initial;
  const { updateRating, addEvent, updateEvent, removeEvent, remove, loading, error } = useReviewMutations();
  const showToast = useToastStore((s) => s.show);
  const [step, setStep] = useState<Step>({ kind: "detail" });
  const [appendDraft, setAppendDraft] = useState<ReviewEventInput>(() => emptyReviewEvent());
  const [editDraft, setEditDraft] = useState<ReviewEventInput>(() => emptyReviewEvent());

  useEffect(() => {
    if (open && gone) onClose();
  }, [open, gone, onClose]);

  const confirmed = async (request: () => Promise<Review | null>, message?: string) => {
    const result = await request();
    if (result) {
      apply(result);
      if (message) showToast(message);
    }
    return result;
  };

  const deleteEvent = async (eventId: string) => {
    const last = review.events.length <= 1;
    if (!confirm(last ? "最後の出来事を削除すると、クチコミも削除されます。よろしいですか？" : "この出来事を削除しますか？")) return;
    // Stop reading the review before the server may delete it, as the whole-review deletion does.
    if (last) setDeleting(true);
    const result = await removeEvent(eventId);
    if (!result) {
      setDeleting(false);
      return;
    }
    if (!result.review) {
      showToast("クチコミを削除しました");
      onClose();
      return;
    }
    apply(result.review);
    showToast("出来事を削除しました");
  };

  const startEdit = (eventId: string) => {
    const target = review.events.find((event) => event.id === eventId);
    if (!target) return;
    setEditDraft({ stage: target.stage, outcome: target.outcome, tags: target.tags, note: target.note, occurredOn: target.occurredOn });
    setStep({ kind: "edit", eventId });
  };

  const body = () => {
    if (step.kind === "append") {
      return (
        <ReviewEventForm
          cast={review.target}
          value={appendDraft}
          onChange={setAppendDraft}
          submitLabel="この段階を追記"
          submitting={loading}
          error={error?.message ?? null}
          onSubmit={async () => {
            if (!(await confirmed(() => addEvent(review.id, appendDraft), "クチコミに追記しました"))) return;
            setAppendDraft(emptyReviewEvent());
            setStep({ kind: "detail" });
          }}
        />
      );
    }
    if (step.kind === "edit") {
      return (
        <ReviewEventForm
          cast={review.target}
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
        <p className="text-xs font-bold tracking-wide text-text-secondary">クチコミ</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar src={review.target?.avatarUrl || undefined} fallback={profileInitial(review.target)} size="sm" />
            <div className="min-w-0">
              <p className="truncate"><ProfileName profile={review.target} missing={MISSING_CAST} /></p>
              <p className="truncate text-xs text-text-secondary">
                {review.target?.username ? `@${review.target?.username} · ` : ""}書いた人 <ProfileName profile={review.author} className="font-normal" missing={review.authorHidden ? HIDDEN_GUEST : MISSING_GUEST} />
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-text-primary">
              {review.rating === null ? "—" : review.rating.toFixed(1)} <span className="text-base text-rating">★</span>
            </p>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {review.rating === null ? "星を付けると平均評価に反映されます" : "平均評価に反映されています"}
          </p>
          {review.isMine && (
            <div className="mt-3">
              <StarRatingInput label="利用の満足度" value={review.rating} disabled={loading} onChange={(rating) => void confirmed(() => updateRating(review.id, rating))} />
            </div>
          )}
        </div>

        <section>
          <h3 className="mb-3 text-sm font-bold text-text-primary">予約から利用後までの記録</h3>
          <ol className="flex flex-col gap-3">
            {review.events.map((event) => (
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
                {review.isMine && (
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

        {review.isMine && (
          <Button type="button" variant="secondary" onClick={() => setStep({ kind: "append" })}>
            ＋ 段階を追記する
          </Button>
        )}

        {review.isMine && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                if (!confirm("このクチコミを削除しますか？出来事もすべて削除されます。")) return;
                setDeleting(true);
                if (!(await remove(review.id))) {
                  setDeleting(false);
                  return;
                }
                showToast("クチコミを削除しました");
                onClose();
              }}
              className="min-h-11 text-sm text-error hover:underline disabled:opacity-50"
            >
              このクチコミを削除
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
