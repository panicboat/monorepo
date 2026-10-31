"use client";

import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { useBackDismiss } from "./useBackDismiss";

export interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onBack?: () => void;
  stepKey?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-bg-secondary hover:text-text-primary";

export function SideSheet({ open, onOpenChange, title, onBack, stepKey, footer, children }: SideSheetProps) {
  const pathname = usePathname();
  const openedOn = useRef(pathname);
  const opener = useRef<HTMLElement | null>(null);

  useBackDismiss(open, () => onOpenChange(false));

  useEffect(() => {
    if (!open) {
      openedOn.current = pathname;
      return;
    }
    if (openedOn.current !== pathname) onOpenChange(false);
  }, [open, pathname, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-sheet-overlay
          className="fixed inset-0 z-50 bg-black/70 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in"
        />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          // Restore focus by hand: without a Dialog.Trigger the dialog has no element to return it to.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          // Radix hears Escape in the capture phase, before an open combobox inside can close only its suggestions.
          onEscapeKeyDown={(event) => {
            if (event.target instanceof Element && event.target.matches('[role="combobox"][aria-expanded="true"]')) event.preventDefault();
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[510px] flex-col bg-bg-elevated shadow-2xl data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in md:border-l md:border-border"
        >
          <header className="flex min-h-[72px] items-center gap-3 border-b border-divider px-4 md:px-5">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="前に戻る" className={ICON_BUTTON}>
                <ArrowLeft className="size-5" />
              </button>
            )}
            <Dialog.Title className="min-w-0 flex-1 truncate text-lg font-bold text-text-primary">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="閉じる" className={ICON_BUTTON}>
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </header>
          <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-5">
            <div key={stepKey} className="animate-sheet-step">
              {children}
            </div>
          </div>
          {footer && <div className="flex min-h-[62px] shrink-0 items-center border-t border-divider px-4 md:px-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
