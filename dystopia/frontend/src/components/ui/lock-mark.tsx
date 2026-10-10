import { cn } from "@/lib/utils";

export interface LockMarkProps {
  label: string;
  className?: string;
}

export function LockMark({ label, className }: LockMarkProps) {
  return (
    <span role="img" aria-label={label} title={label} className={cn("shrink-0", className)}>
      🔒
    </span>
  );
}
