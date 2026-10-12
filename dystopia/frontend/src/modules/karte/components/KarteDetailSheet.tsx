"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SideSheet } from "@/components/ui/side-sheet";
import { Button } from "@/components/ui/button";
import { RatingInput } from "@/components/ui/rating-input";
import { RatingStars } from "@/components/ui/rating-stars";
import { Textarea } from "@/components/ui/textarea";
import { IdentityLink } from "@/components/ui/identity-link";
import { AppError } from "@/lib/errors";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useKarte, useKarteEvents, useKarteLifecycle, useUpdateKarte, useDeleteKarte, useReportKarte } from "../hooks";
import { KarteInactiveViewError } from "../hooks/useKarteMutation";
import { japanToday, validateKarte } from "../lib/validation";
import { KarteEventForm } from "./KarteEventForm";
import { KarteEventTimeline } from "./KarteEventTimeline";
import type { KarteEntry, KarteEventInput } from "../types";

type Step = "detail" | "event" | "rating" | "delete" | "delete-event" | "report";
interface Props { entryId: string | null; onOpenChange: (open: boolean) => void; onChanged?: (entryId: string) => void; }

export function KarteDetailSheet({ entryId, onOpenChange, onChanged }: Props) {
  const [view, setView] = useState({ id: entryId, open: entryId !== null });
  const [step, setStep] = useState<Step>("detail");
  if (view.open !== (entryId !== null) || (entryId !== null && view.id !== entryId)) {
    setView({ id: entryId ?? view.id, open: entryId !== null });
    if (entryId !== null) setStep("detail");
  }
  const { entry, loading, error: readError, refresh } = useKarte(view.id);
  const events = useKarteEvents(view.id || "");
  const lifecycle = useKarteLifecycle(view.id || "");
  const update = useUpdateKarte();
  const remove = useDeleteKarte();
  const report = useReportKarte();
  const activeProfileId = useAuthStore((state) => state.activeProfileId);
  const busy = events.loading || lifecycle.loading || update.loading || remove.loading || report.loading;
  const [draft, setDraft] = useState<KarteEventInput>(() => ({ stage: "booking", outcome: "", tags: [], note: "", occurredOn: japanToday() }));
  const [eventId, setEventId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const formId = useId();
  const mounted = useRef(false);
  const ui = useRef({ id: entryId, step });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { ui.current = { id: entryId, step }; }, [entryId, step]);
  const canEdit = !!entry?.isMine && entry.status === "open";
  const changeOpen = (open: boolean) => { if (!open) ui.current.id = null; onOpenChange(open); };
  const back = () => { setStep("detail"); setActionError(null); setFormErrors({}); };

  async function perform(operation: () => Promise<KarteEntry | boolean>, kind: "entry" | "delete" | "report" = "entry") {
    if (!entry || busy) return;
    const requestedId = entry.id;
    const requestedStep = step;
    const actor = useAuthStore.getState();
    const sameActor = () => useAuthStore.getState().accountId === actor.accountId && useAuthStore.getState().activeProfileId === actor.activeProfileId;
    const active = () => mounted.current && sameActor() && ui.current.id === requestedId;
    setActionError(null);
    try {
      const result = await operation();
      if (!result) throw new Error("操作を完了できませんでした");
      if (!active()) return;
      if (kind === "delete") { onChanged?.(requestedId); changeOpen(false); return; }
      if (kind === "report") useToastStore.getState().show("報告を送信しました");
      else await refresh({ entry: result as KarteEntry }, { revalidate: false });
      if (!active()) return;
      setStep("detail"); onChanged?.(requestedId);
    } catch (cause) {
      // SILENT: A completed response from an inactive view must not become an error in another editor.
      if (!sameActor() || cause instanceof KarteInactiveViewError) return;
      const message = cause instanceof Error ? cause.message : "操作を完了できませんでした";
      if (active() && ui.current.step === requestedStep) setActionError(message);
      else useToastStore.getState().show(message);
      if (active() && cause instanceof AppError && cause.status === 409) await refresh(undefined, { throwOnError: false });
    }
  }

  const title = step === "event" ? eventId ? "出来事を編集" : "出来事を追加" : step === "rating" ? "評価・過去のメモ" : step === "delete" ? "カルテを削除" : step === "delete-event" ? "出来事を削除" : step === "report" ? "カルテを報告" : "カルテ詳細";
  const eventIndex = eventId ? entry?.events.findIndex((event) => event.id === eventId) ?? 0 : entry?.events.length ?? 0;
  const eventErrors = Object.fromEntries(Object.entries(formErrors).filter(([key]) => key.startsWith(`events.${eventIndex}.`)).map(([key, message]) => [key.slice(`events.${eventIndex}.`.length), message]));
  if (formErrors.note) eventErrors.note = formErrors.note;
  const footer = !entry ? undefined : step === "event" || step === "rating" || step === "report" ? <Button form={formId} type="submit" disabled={busy || (step !== "report" && !canEdit)} className="w-full">{busy ? "保存中…" : step === "report" ? "報告を送信" : "変更を保存"}</Button>
    : step === "delete" ? <Button type="button" disabled={busy} onClick={() => void perform(() => remove.remove(entry.id), "delete")} className="w-full">カルテを削除する</Button>
    : step === "delete-event" ? <Button type="button" disabled={busy || !canEdit || entry.eventCount <= 1} onClick={() => void perform(() => events.remove(eventId!))} className="w-full">出来事を削除する</Button>
    : entry.isMine ? <>{canEdit ? <><Button variant="secondary" disabled={busy} onClick={() => { setEventId(null); setDraft({ stage: "booking", outcome: "", tags: [], note: "", occurredOn: japanToday() }); setFormErrors({}); setActionError(null); setStep("event"); }}>出来事を追加</Button><Button disabled={busy} onClick={() => void perform(lifecycle.close)}>完了する</Button></> : <Button disabled={busy} onClick={() => void perform(lifecycle.reopen)} className="w-full">再オープンする</Button>}</> : undefined;

  return <SideSheet open={entryId !== null} onOpenChange={changeOpen} title={title} onBack={step !== "detail" ? back : undefined} footer={footer}>
    {loading && !entry && <p className="py-8 text-center text-sm text-text-secondary">カルテを読み込み中…</p>}
    {readError && <div role="alert" className="space-y-3 py-4"><p className="text-sm text-error">{readError.message || "カルテを取得できませんでした"}</p><Button variant="secondary" onClick={() => void refresh(undefined, { throwOnError: false })}>再試行</Button></div>}
    {entry && <>
      {actionError && <p role="alert" className="mb-4 rounded-xl border border-error/40 p-3 text-sm text-error">{actionError}</p>}
      {(step === "event" || step === "rating") && !canEdit && <p className="mb-4 text-sm text-text-secondary">完了したカルテは変更できません。詳細に戻って再オープンしてください。</p>}
      {step === "detail" && <div className="space-y-6">
        <div className="space-y-3 rounded-xl border border-divider bg-bg/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-border px-3 py-1 text-xs">{entry.status === "open" ? "記録中" : "完了"}</span><span className="text-xs text-text-secondary">出来事 {entry.eventCount}件</span></div>
          <div className="flex flex-wrap items-center gap-3 text-sm"><IdentityLink username={entry.authorUsername} avatarUrl={entry.authorAvatarUrl} /><span className="text-text-secondary">→</span><IdentityLink username={entry.targetUsername} avatarUrl={entry.targetAvatarUrl} /></div>
          {entry.isMine && entry.authorProfileId !== activeProfileId && <p className="text-xs text-text-secondary">{entry.authorUsername ? `@${entry.authorUsername} として記録` : "削除したプロフィールで記録"}</p>}
          <div className="flex items-center gap-2">{entry.rating === null ? <span className="text-sm text-text-secondary">未評価</span> : <><RatingStars value={entry.rating} /><span className="text-sm text-text-secondary">{entry.rating} / 5</span></>}</div>
          {entry.closedAt && <p className="text-xs text-text-secondary">完了日 {new Date(entry.closedAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>}
          {canEdit && <button type="button" disabled={busy} onClick={() => { setRating(entry.rating); setBody(entry.body); setFormErrors({}); setActionError(null); setStep("rating"); }} className="min-h-10 text-sm font-medium text-accent">評価・メモを変更</button>}
        </div>
        {entry.flagged && <p className="rounded-xl border border-warning/40 p-3 text-xs text-text-secondary">この記録には他のキャストから複数の報告があります。</p>}
        {entry.body && <section className="space-y-2"><h3 className="text-sm font-bold">過去のメモ</h3><p className="whitespace-pre-wrap wrap-anywhere rounded-xl border border-divider p-4 text-sm leading-relaxed">{entry.body}</p></section>}
        <KarteEventTimeline events={entry.events} readOnly={!canEdit || busy} onEdit={(event) => { setEventId(event.id); setDraft({ stage: event.stage, outcome: event.outcome, tags: [...event.tags], note: event.note, occurredOn: event.occurredOn }); setFormErrors({}); setActionError(null); setStep("event"); }} onDelete={(id) => { setEventId(id); setActionError(null); setStep("delete-event"); }} />
        <div className="border-t border-divider pt-3">{entry.isMine ? <button type="button" disabled={busy} onClick={() => { setActionError(null); setStep("delete"); }} className="min-h-11 text-sm text-error">カルテを削除</button> : <button type="button" disabled={busy} onClick={() => { setReason(""); setActionError(null); setStep("report"); }} className="min-h-11 text-sm text-text-secondary">報告</button>}</div>
      </div>}
      {step === "event" && <form id={formId} noValidate onSubmit={async (submit) => {
        submit.preventDefault();
        const proposed = eventId ? entry.events.map((event) => event.id === eventId ? draft : event) : [...entry.events, draft];
        const invalid = validateKarte({ rating: entry.rating, body: entry.body, events: proposed }); setFormErrors(invalid);
        if (Object.keys(invalid).length) return;
        await perform(() => eventId ? events.update(eventId, draft) : events.add(draft));
      }}><KarteEventForm value={draft} onChange={(value) => { setDraft(value); setFormErrors({}); setActionError(null); }} errors={eventErrors} disabled={busy || !canEdit} /></form>}
      {step === "rating" && <form id={formId} noValidate className="space-y-5" onSubmit={async (submit) => {
        submit.preventDefault(); const invalid = validateKarte({ rating, body, events: entry.events }); setFormErrors(invalid);
        if (Object.keys(invalid).length) return;
        await perform(() => update.update(entry.id, { rating, body }));
      }}>
        <div><p className="text-sm font-bold">予約・接客の信頼性</p><RatingInput value={rating} onChange={(value) => { setRating(value); setFormErrors({}); }} allowUnrated disabled={busy || !canEdit} /><p className="text-xs text-text-secondary">3が標準です。星1には出来事か過去のメモに説明が必要です。</p></div>
        <div className="space-y-2"><label htmlFor={`${formId}-body`} className="text-sm font-bold">過去のメモ</label><Textarea id={`${formId}-body`} value={body} onChange={(event) => { setBody(event.target.value); setFormErrors({}); }} disabled={busy || !canEdit} /><p className="text-right text-xs text-text-secondary">{Array.from(body).length}/500</p></div>
        {!!Object.keys(formErrors).length && <p role="alert" className="text-sm text-error">{Object.values(formErrors)[0]}</p>}
      </form>}
      {step === "report" && <form id={formId} className="space-y-3" onSubmit={async (submit) => { submit.preventDefault(); await perform(() => report.report(entry.id, reason), "report"); }}><label htmlFor={`${formId}-reason`} className="text-sm font-bold">報告の理由（任意）</label><Textarea id={`${formId}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} /></form>}
      {step === "delete" && <p className="text-sm leading-relaxed text-text-secondary">このカルテと全ての出来事を削除します。削除すると元に戻せません。</p>}
      {step === "delete-event" && <p className="text-sm leading-relaxed text-text-secondary">この出来事を削除します。最後の出来事は削除できません。</p>}
    </>}
  </SideSheet>;
}
