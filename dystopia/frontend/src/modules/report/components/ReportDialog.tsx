"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth";
import { useToastStore } from "@/stores/toastStore";
import type { ReportTargetType } from "../types";

const REASONS = [
  { value: "defamation", label: "誹謗中傷" },
  { value: "threat", label: "脅迫" },
  { value: "stalking", label: "つきまとい" },
  { value: "harassment", label: "嫌がらせ" },
  { value: "other", label: "その他" },
];
const NOTE_MAX_LENGTH = 200;

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await authFetch("/api/reports", { method: "POST", body: { targetType, targetId, reason, note } });
      useToastStore.getState().show("通報を受け付けました");
      setReason("");
      setNote("");
      onOpenChange(false);
    } catch {
      useToastStore.getState().show("通報できませんでした");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          aria-describedby={undefined}
          // React events bubble through the portal, so a click here would otherwise reach the card behind the dialog.
          onClick={(event) => event.stopPropagation()}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-5"
        >
          <Dialog.Title className="text-base font-bold text-text-primary">通報</Dialog.Title>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm text-text-secondary">理由</legend>
            {REASONS.map((option) => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-primary">
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <Textarea
            aria-label="補足（任意）"
            placeholder="補足（任意）"
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={onSubmit} disabled={!reason || submitting}>
              通報する
            </Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
              キャンセル
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
