"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

interface AgeConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
}

export function AgeConfirmModal({ open, onConfirm }: AgeConfirmModalProps) {
  const [declined, setDeclined] = useState(false);

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/80" />
        <Dialog.Content
          aria-describedby="age-confirm-description"
          className="fixed left-1/2 top-1/2 z-50 flex w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <Dialog.Title className="text-base font-bold text-text-primary">年齢の確認</Dialog.Title>
          {declined ? (
            <p id="age-confirm-description" role="alert" className="text-sm text-text-primary">
              18歳未満の方はご利用いただけません。
            </p>
          ) : (
            <>
              <p id="age-confirm-description" className="text-sm text-text-primary">
                このサービスは18歳以上の方を対象としています。あなたは18歳以上ですか？
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="primary" onClick={onConfirm}>
                  はい（18歳以上です）
                </Button>
                <Button variant="secondary" onClick={() => setDeclined(true)}>
                  いいえ
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
