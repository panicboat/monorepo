"use client";

import { SideSheet } from "@/components/ui/side-sheet";
import type { CreateProfilePayload } from "@/modules/profile/types";
import { ProfileNameForm } from "./ProfileNameForm";

interface AddProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Required<CreateProfilePayload>) => Promise<void>;
}

export function AddProfileSheet({ open, onClose, onSubmit }: AddProfileSheetProps) {
  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="プロフィールを追加"
    >
      <p className="mb-4 text-sm text-text-secondary">別の名前で使うプロフィールを追加できます。</p>
      <ProfileNameForm submitLabel="追加して切り替える" onCancel={onClose} onSubmit={onSubmit} />
    </SideSheet>
  );
}
