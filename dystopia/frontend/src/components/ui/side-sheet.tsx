"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { useBackDismiss } from "@/lib/motion/useBackDismiss";

interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  historyMode?: "managed" | "route";
}

export function SideSheet({ open, onOpenChange, title, children, footer, onBack, historyMode = "managed" }: SideSheetProps) {
  const origin = useRef<HTMLElement | null>(null);
  useBackDismiss({ open, onDismiss: () => onOpenChange(false), enabled: historyMode === "managed" });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="side-sheet-overlay fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          aria-describedby={undefined}
          className="side-sheet fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[510px] flex-col border-l border-border bg-surface shadow-2xl"
          onOpenAutoFocus={() => { origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={(event) => { if (origin.current?.isConnected) { event.preventDefault(); origin.current.focus(); } }}
        >
          <div className="flex min-h-[72px] shrink-0 items-center gap-2 border-b border-divider px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 md:px-5">
            {onBack && <button type="button" onClick={onBack} aria-label="前の画面に戻る" className="grid size-11 shrink-0 place-items-center rounded-xl text-text-secondary hover:bg-bg-secondary"><ArrowLeft className="size-5" /></button>}
            <Dialog.Title className="min-w-0 flex-1 text-lg font-bold">{title}</Dialog.Title>
            <Dialog.Close asChild><button type="button" aria-label="閉じる" className="grid size-11 shrink-0 place-items-center rounded-xl text-text-secondary hover:bg-bg-secondary"><X className="size-5" /></button></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:px-5">{children}</div>
          {footer && <div className="flex shrink-0 items-center justify-end gap-3 border-t border-divider px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
