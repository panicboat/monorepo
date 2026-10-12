"use client";

import { eventCatalog, karteStages } from "../lib/event-catalog";
import type { KarteEvent } from "../types";

interface Props {
  events: KarteEvent[];
  readOnly: boolean;
  onEdit?: (event: KarteEvent) => void;
  onDelete?: (eventId: string) => void;
}

export function KarteEventTimeline({ events, readOnly, onEdit, onDelete }: Props) {
  if (!events.length) return <p className="rounded-xl border border-divider p-5 text-sm text-text-secondary">出来事はまだありません</p>;
  return <div className="space-y-6">{karteStages.map((stage) => {
    const rows = events.filter((event) => event.stage === stage).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    if (!rows.length) return null;
    const catalog = eventCatalog[stage];
    const outcomes: Record<string, string> = catalog.outcomes;
    const tags: Record<string, string> = catalog.tags;
    return <section key={stage} aria-label={catalog.label} className="space-y-3">
      <h3 className="text-sm font-bold text-accent">{catalog.label}</h3>
      <ol className="space-y-3 border-l border-divider pl-4">{rows.map((event) => <li key={event.id} className="rounded-xl border border-divider bg-bg/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold">{outcomes[event.outcome]}</span><time dateTime={event.occurredOn} className="text-xs text-text-secondary">{event.occurredOn}</time></div>
        {!!event.tags.length && <div className="mt-2 flex flex-wrap gap-1.5">{event.tags.map((tag) => <span key={tag} className="rounded-full border border-border px-2 py-1 text-xs text-text-secondary">{tags[tag]}</span>)}</div>}
        {event.note && <p className="mt-3 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed">{event.note}</p>}
        {!readOnly && <div className="mt-3 flex gap-4 text-xs">
          {onEdit && <button type="button" aria-label={`出来事を編集：${outcomes[event.outcome]}`} onClick={() => onEdit(event)} className="min-h-10 font-medium text-accent">編集</button>}
          {onDelete && <button type="button" aria-label={`出来事を削除：${outcomes[event.outcome]}`} disabled={events.length <= 1} title={events.length <= 1 ? "最後の出来事は削除できません" : undefined} onClick={() => onDelete(event.id)} className="min-h-10 text-error disabled:text-text-muted">削除</button>}
        </div>}
      </li>)}</ol>
    </section>;
  })}</div>;
}
