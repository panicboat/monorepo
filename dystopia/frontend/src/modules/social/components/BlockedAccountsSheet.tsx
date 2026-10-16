"use client";

import { SideSheet } from "@/components/ui/side-sheet";
import { BlockedAccountsList } from "./BlockedAccountsList";

export function BlockedAccountsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="ブロックしたアカウント"
    >
      <div className="-mx-4 md:-mx-5">
        <BlockedAccountsList />
      </div>
    </SideSheet>
  );
}
