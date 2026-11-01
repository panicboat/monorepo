"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";

const ITEM_CLASS =
  "cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-bg-secondary";

interface PostMoreMenuProps {
  pinned: boolean;
  pinning: boolean;
  deleting: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
}

export function PostMoreMenu({ pinned, pinning, deleting, onTogglePin, onDelete }: PostMoreMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="-my-3 flex min-h-11 min-w-11 items-center justify-end text-text-secondary hover:text-text-primary"
        aria-label="その他の操作"
      >
        <Ellipsis className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-40 rounded-xl border border-border bg-surface p-1 shadow-2xl"
        >
          <DropdownMenu.Item disabled={pinning} onSelect={onTogglePin} className={`${ITEM_CLASS} text-text-primary`}>
            {pinned ? "ピン留めを外す" : "ピン留めする"}
          </DropdownMenu.Item>
          <DropdownMenu.Item disabled={deleting} onSelect={onDelete} className={`${ITEM_CLASS} text-error`}>
            削除
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
