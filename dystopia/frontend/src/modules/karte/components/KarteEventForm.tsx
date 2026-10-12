"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { eventCatalog, karteStages } from "../lib/event-catalog";
import type { KarteEventInput } from "../types";

interface KarteEventFormProps {
  value: KarteEventInput;
  onChange: (value: KarteEventInput) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function KarteEventForm({ value, onChange, errors = {}, disabled }: KarteEventFormProps) {
  const id = useId();
  const catalog = eventCatalog[value.stage];
  const noteRequired = catalog.noteOutcomes.some((outcome) => outcome === value.outcome) || catalog.noteTags.some((tag) => value.tags.includes(tag));
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div className="space-y-2"><span className="text-sm font-bold">段階</span>
        <div className="flex flex-wrap gap-2">{karteStages.map((stage) => <button key={stage} type="button" disabled={disabled} aria-pressed={value.stage === stage} onClick={() => { if (stage !== value.stage) onChange({ ...value, stage, outcome: "", tags: [] }); }} className={cn("min-h-11 rounded-full border px-4 text-sm font-medium", value.stage === stage ? "border-accent bg-accent/15 text-accent" : "border-border text-text-secondary")}>{eventCatalog[stage].label}</button>)}</div>
      </div>
      <div className="space-y-2"><label htmlFor={`${id}-outcome`} className="text-sm font-bold">対応結果 <span className="text-text-secondary">（必須）</span></label>
        <Select id={`${id}-outcome`} value={value.outcome} onChange={(event) => onChange({ ...value, outcome: event.target.value })} disabled={disabled} aria-invalid={!!errors.outcome}><option value="">選択してください</option>{Object.entries(catalog.outcomes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select>
        {errors.outcome && <p role="alert" className="text-sm text-error">{errors.outcome}</p>}
      </div>
      <div className="space-y-2"><label htmlFor={`${id}-date`} className="text-sm font-bold">発生日 <span className="text-text-secondary">（必須）</span></label>
        <Input id={`${id}-date`} type="date" value={value.occurredOn} onChange={(event) => onChange({ ...value, occurredOn: event.target.value })} disabled={disabled} aria-invalid={!!errors.occurredOn} />
        {errors.occurredOn && <p role="alert" className="text-sm text-error">{errors.occurredOn}</p>}
      </div>
      <div className="space-y-2"><span className="text-sm font-bold">詳細タグ <span className="font-normal text-text-secondary">（複数選択・任意）</span></span>
        <div className="flex flex-wrap gap-2">{Object.entries(catalog.tags).map(([code, label]) => <label key={code} className={cn("relative inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-xs font-medium", value.tags.includes(code) ? "border-accent bg-accent/15 text-accent" : "border-border text-text-secondary")}><input type="checkbox" className="peer sr-only" checked={value.tags.includes(code)} disabled={disabled} onChange={(event) => onChange({ ...value, tags: event.target.checked ? [...value.tags, code] : value.tags.filter((tag) => tag !== code) })} /><span className="rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{label}</span></label>)}</div>
        {errors.tags && <p role="alert" className="text-sm text-error">{errors.tags}</p>}
      </div>
      <div className="space-y-2"><label htmlFor={`${id}-note`} className="text-sm font-bold">補足 <span className="text-text-secondary">（{noteRequired ? "必須" : "任意"}）</span></label>
        <Textarea id={`${id}-note`} value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} rows={4} disabled={disabled} aria-invalid={!!errors.note} aria-describedby={`${id}-note-hint`} />
        <div className="flex justify-between gap-3 text-xs text-text-secondary"><span id={`${id}-note-hint`}>個人情報は書かず、対応の事実を記録してください</span><span className={Array.from(value.note).length > 500 ? "text-error" : undefined}>{Array.from(value.note).length}/500</span></div>
        {errors.note && <p role="alert" className="text-sm text-error">{errors.note}</p>}
      </div>
    </fieldset>
  );
}
