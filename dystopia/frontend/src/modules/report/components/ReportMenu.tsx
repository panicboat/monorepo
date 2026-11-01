"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";
import type { ReportTargetType } from "../types";
import { ReportDialog } from "./ReportDialog";

interface ReportMenuProps {
  targetType: ReportTargetType;
  targetId: string;
}

export function ReportMenu({ targetType, targetId }: ReportMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root modal={false}>
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
            <DropdownMenu.Item
              onSelect={() => setOpen(true)}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary outline-none data-[highlighted]:bg-bg-secondary"
            >
              通報
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ReportDialog open={open} onOpenChange={setOpen} targetType={targetType} targetId={targetId} />
    </>
  );
}
