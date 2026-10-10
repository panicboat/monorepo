"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { useBlock } from "@/modules/social/hooks";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";

interface ProfileMoreMenuProps {
  targetProfileId: string;
}

export function ProfileMoreMenu({ targetProfileId }: ProfileMoreMenuProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const { isBlocked, toggle, loading } = useBlock(targetProfileId);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="sm" className="w-9 px-0" aria-label="その他の操作">
          <span aria-hidden="true">⋯</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-40 rounded-xl border border-border bg-surface p-1 shadow-2xl"
        >
          <DropdownMenu.Item
            disabled={loading}
            onSelect={toggle}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-bg-secondary"
          >
            {isBlocked ? "ブロック解除" : "ブロック"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
