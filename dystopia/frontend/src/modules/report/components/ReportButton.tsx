"use client";

import { useState } from "react";
import type { ReportTargetType } from "../types";
import { ReportDialog } from "./ReportDialog";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  label: string;
  className?: string;
}

export function ReportButton({ targetType, targetId, label, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <ReportDialog open={open} onOpenChange={setOpen} targetType={targetType} targetId={targetId} />
    </>
  );
}
