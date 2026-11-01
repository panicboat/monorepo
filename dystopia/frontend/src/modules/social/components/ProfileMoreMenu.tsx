"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/modules/report";
import { useBlock } from "@/modules/social/hooks";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { toastOnFailure } from "@/stores/toastStore";

interface ProfileMoreMenuProps {
  targetProfileId: string;
  onUnfollow?: () => void;
}

export function ProfileMoreMenu({ targetProfileId, onUnfollow }: ProfileMoreMenuProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const { isBlocked, toggle, loading } = useBlock(targetProfileId);
  const [reporting, setReporting] = useState(false);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

  const onToggle = () => {
    void toggle().catch(toastOnFailure(isBlocked ? "ブロックを解除できませんでした" : "ブロックできませんでした"));
  };

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button variant="secondary" size="sm" className="w-9 px-0" aria-label="その他の操作">
            <Ellipsis className="size-5" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-40 rounded-xl border border-border bg-surface p-1 shadow-2xl"
          >
            {onUnfollow && (
              <DropdownMenu.Item
                onSelect={onUnfollow}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-bg-secondary"
              >
                フォローを外す
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item
              disabled={loading}
              onSelect={onToggle}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-bg-secondary"
            >
              {isBlocked ? "ブロック解除" : "ブロック"}
            </DropdownMenu.Item>
            {viewerId && (
              <DropdownMenu.Item
                onSelect={() => setReporting(true)}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-bg-secondary"
              >
                通報
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ReportDialog open={reporting} onOpenChange={setReporting} targetType="profile" targetId={targetProfileId} />
    </>
  );
}
