import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LockMarkProps {
  label: string;
  className?: string;
}

export function LockMark({ label, className }: LockMarkProps) {
  return (
    <span role="img" aria-label={label} title={label} className={cn("inline-flex shrink-0 items-center", className)}>
      <Lock className="size-[1em]" />
    </span>
  );
}
